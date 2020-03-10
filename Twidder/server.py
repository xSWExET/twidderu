from flask import Flask, escape, request, jsonify
from flask_bcrypt import Bcrypt
import Twidder.database_helper as database_helper
from geventwebsocket.handler import WebSocketHandler
import geventwebsocket
import hashlib
import hmac

import json
import random
import math

# File uploading
import os
from werkzeug.utils import secure_filename
from flask import redirect, render_template, url_for, send_from_directory, send_file, safe_join

ALLOWED_EXTENSIONS = {'mp4', 'webm', 'ogg', 'png', 'jpg', 'jpeg', 'gif'}
UPLOAD_FOLDER = 'videos/'

app = Flask(__name__, static_url_path='', static_folder='static')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 1 #This fixed so that if you change your image it will change it directly when uploaded
bcrypt = Bcrypt(app)

sockets = {}

def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_type(filename):
    return filename.rsplit('.', 1)[1].lower()

@app.route('/upload_file', methods=['POST'])
def upload_file():
    hash = request.cookies['hash_value']
    email = request.cookies['email']

    if not validate(hash, email, "/upload_file", email):
        return redirect("/")

    if 'file' not in request.files:
        print("File not included")
        return redirect("/")
    file = request.files['file']
    if file.filename == '':
        print("File name was nothing")
        return redirect("/")
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)

        user_file = database_helper.get_profile_image(email)
        if (user_file and user_file != "default.jpg" and os.path.exists('videos/'+user_file)):
            print("Deleting")
            os.remove('videos/'+user_file)

        name_salt = generateToken(8)
        file_name_to_save = email + name_salt + "." + get_file_type(file.filename)
        print(file_name_to_save)

        file.save(os.path.join(app.config['UPLOAD_FOLDER'],file_name_to_save))
        database_helper.set_profile_image(file_name_to_save, email)
        return redirect("/")
    print("Error")
    return redirect("/")


@app.route('/get_image/<filename>')
def get_image(filename):
    try:
        return send_file("videos/"+filename, as_attachment=True)
    except FileNotFoundError:
        return "", 500


@app.route("/update_profile_pic<email>")
def update_profile_pic(email = None):
    try:
        hash = request.headers['Authorization']
        data = email

        if not validate(hash, email, "/update_profile_pic", data):
            return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

        file = database_helper.get_profile_image(email)
        return json.dumps({"success": True, "message": "Profile pic successfully received", "data": url_for('get_image', filename=file)}), 200
    except FileNotFoundError:
        return json.dumps({"success": False, "message": "Profile pic unsuccessfully received", "data": []}), 500

@app.route('/update_visited_profile_pic<user_email>/<other_user_email>')
def update_visited_profile_pic(user_email = None, other_user_email = None):
    try:
        hash = request.headers['Authorization']
        data = user_email + other_user_email
        if not validate(hash, user_email, "/update_visited_profile_pic", data):
            return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

        file = database_helper.get_profile_image(other_user_email)
        return json.dumps({"success": True, "message": "Visited profile pic successfully received",
                            "data": url_for('get_image', filename=file)}), 200
    except FileNotFoundError:
        return json.dumps({"success": False, "message": "Visited profile pic unsuccessfully received", "data": []}), 500


'''
Is called when the client initiates communication over websockets
'''
@app.route('/api')
def api():
    print("API called")
    if request.environ.get('wsgi.websocket'):
        ws = request.environ['wsgi.websocket']
        try:
            while True:
                token = ws.receive()
                # Message must be valid and not None
                if token is not None:

                    sockets[token] = ws
                print("We have " + str(len(sockets)) + " connections")
            return "OK"
        except geventwebsocket.exceptions.WebSocketError as e:
            return "FAIL"
    return "OK"


'''
Leads to the startpage by returning the static file client.html
'''
@app.route('/')
def get():
    return app.send_static_file("client.html")


'''
This function is used in the sign_up funcion in
order to validate the data sent by the user
'''
def validInputData(data):
    if ('email' in data and 'password' in data and
        'firstName' in data and 'familyName' in data and
        'gender' in data and 'city' in data and 'country' in data):

        if ((data['email'] is not None) and (data['password'] is not None) and
            (data['firstName'] is not None) and (data['familyName'] is not None) and
            (data['gender'] is not None) and (data['city'] is not None) and
            (data['country'] is not None)):

            if (len(data['email']) <= 50 and len(data['password']) <= 50 and
                len(data['firstName']) <= 30 and len(data['familyName']) <= 40 and
                len(data['gender']) <= 20 and len(data['city']) <= 100 and
                len(data['country']) <= 100 and len(data['password']) >= 7):

                return True
    return False

'''
This function is used to sign in the user
'''
@app.route('/sign_in', methods = ['PUT'])
def sign_in():
    data = request.json
    if ('email' in data and 'password' in data):
        if (len(data['email']) <= 50 and len(data['password']) <= 30):
            pw_hash = database_helper.get_user_password(data['email'])
            if (pw_hash == None):
                return json.dumps({"success": False, "message": "Email does not exist", "data": []}), 200
            elif bcrypt.check_password_hash(pw_hash, data['password']):
                if (database_helper.check_if_logged_in(data['email'])):
                    print("Remove token in database")
                    old_token = database_helper.get_token(data['email'])
                    database_helper.remove_token(old_token)
                    # Remove from active sockets
                    if old_token in sockets:
                        try:
                            sockets[old_token].send("Remove token")
                            sockets[old_token].close()
                        except geventwebsocket.exceptions.WebSocketError as e:
                            print("Socket error")
                        del sockets[old_token]

                token = generateToken()
                result = database_helper.set_token(data['email'], token)
                if (result):
                    print("Success")
                    return json.dumps({"success": True, "message": "User was logged in!", "data": [token]}), 200
                else:
                    print("ERROR")
                    return json.dumps({"success": False, "message": "Something was off there mate", "data": []}), 500

            else:
                return json.dumps({"success": False, "message": "Password was incorrect", "data": []}), 200

    return json.dumps({"success": False, "message": "Invalid input data", "data": []}), 500


def generateToken(number = 36):
    letters = "abcdefghiklmnopqrstuvwwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
    token = ""
    for i in range(number):
        token += letters[math.floor(random.uniform(0, 1) * len(letters))]

    return token


@app.route('/sign_up', methods = ['PUT'])
def sign_up():
    data = request.json
    if validInputData(data):
        pw_hash = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        valid_result = database_helper.register_user(data['email'], pw_hash, data['firstName'],
                                                     data['familyName'], data['gender'], data['city'],
                                                     data['country'])
        if valid_result:
            return json.dumps({"success": True, "message": "User registered!", "data": []}), 200
        else:
            return json.dumps({"success": False, "message": "Could not register user", "data": []}), 200
    else:
        return json.dumps({"success": False, "message": "Invalid input", "data": []}), 500


@app.route('/sign_out', methods = ['PUT'])
def sign_out():

    json_data = request.json
    hash = request.headers['Authorization']
    data = json_data['email']

    if not validate(hash, json_data['email'], "/sign_out", data):
        return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

    token = database_helper.get_token(json_data['email'])
    result = database_helper.remove_token(json_data['email'])
    if result:
        sockets[token].close() # Close and remove the socket
        del sockets[token]
        return json.dumps({"success": True, "message": "Token was successfully removed", "data": []}), 200
    else:
        return json.dumps({"success": False, "message": "Could not remove token", "data": []}), 500




@app.route('/change_password', methods = ['PUT'])
def change_password():

    json_data = request.json
    hash = request.headers['Authorization']
    data = ""
    for key in json_data:
        data += json_data[key]
    if not validate(hash, json_data['email'], "/change_password", data):
        return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

    if not('email' in json_data and 'oldPassword' in json_data and 'newPassword' in json_data):
        return json.dumps({"success": False, "message": "Invalid request data", "data": []}), 500

    user_email = json_data['email']
    pw_hash = database_helper.get_user_password(user_email)
    if (user_email == None or pw_hash == None):
        return json.dumps({"success": False, "message": "User does not exist in database", "data": []}), 500
    elif (bcrypt.check_password_hash(pw_hash, json_data['oldPassword'])):
        if (len(json_data['newPassword']) <= 50 and len(json_data['newPassword']) >= 7):
            new_pw_hash = bcrypt.generate_password_hash(json_data['newPassword']).decode('utf-8')
            result = database_helper.change_user_password(user_email, new_pw_hash)
            if result:
                return json.dumps({"success": True, "message": "Password was changed!", "data": []}), 200
            else:
                return json.dumps({"success": False, "message": "Error occurred when changing password", "data": []}), 500
        else:
            return json.dumps({"success": False, "message": "New password is not of proper length", "data": []}), 200
    else:
        return json.dumps({"success": False, "message": "Old password is incorrect", "data": []}), 200


@app.route('/get_private_data<email>')
def get_private_data(email = None):
    hash = request.headers['Authorization']
    data = email
    if not validate(hash, email, "/get_private_data", data):
        return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

    result = database_helper.get_user_profile_data_email(email)
    return json.dumps({"success": True, "message": "Profile data was successfully received", "data": result}), 200


def validate(hash, email, url, data):
    if email is not None:
        token = database_helper.get_token(email)
        if token is not None:
            signature = hmac.new(bytes(token, 'latin-1'), msg=bytes(token + url + data, 'latin-1'), digestmod=hashlib.sha256).hexdigest()
            return signature == hash
    return False


@app.route('/get_visited_data<user_email>/<other_user_email>')
def get_user_data_by_email(user_email = None, other_user_email = None):
    print("SEARCH OTHER USER")
    hash = request.headers['Authorization']
    data = user_email + other_user_email
    if not validate(hash, user_email, "/get_visited_data", data):
        return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

    result = database_helper.get_user_profile_data_email(other_user_email)
    if result is not None:
        return json.dumps({"success": True, "message": "Profile data was successfully retrieved", "data": result}), 200
    else:
        return json.dumps({"success": False, "message": "User profile could not be found", "data": []}), 200


@app.route('/get_private_messages<email>')
def get_private_messages(email = None):

    hash = request.headers['Authorization']
    data = email
    if not validate(hash, email, "/get_private_messages", data):
        return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500


    result = database_helper.get_messages_email(email)
    if result is not None:
        return json.dumps({"success": True, "message": "Messages succesfully retrieved!", "data": result}), 200
    else:
        return json.dumps({"success": False, "message": "User messages could not be found", "data": []}), 200



@app.route('/get_visited_messages<user_email>/<other_user_email>')
def get_visited_messages(user_email = None, other_user_email = None):
    hash = request.headers['Authorization']
    data = user_email + other_user_email
    if not validate(hash, user_email, "/get_visited_messages", data):
        return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

    result = database_helper.get_messages_email(other_user_email)
    if result is not None:
        return json.dumps({"success": True, "message": "Messages succesfully received!", "data": result}), 200
    else:
        return json.dumps({"success": False, "message": "Could not retrieve messages", "data": []}), 200


@app.route('/post_message', methods = ['PUT'])
def post_message():

    json_data = request.json
    hash = request.headers['Authorization']
    data = ""
    for key in json_data:
        data += json_data[key]
    if not validate(hash, json_data['user_email'], "/post_message", data):
        return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

    if json_data['user_email'] is not None and json_data['target_email'] is not None and json_data['message'] is not None:
        if (len(json_data['message']) <= 300):
            result = database_helper.add_message(json_data['user_email'], json_data['target_email'], json_data['message'])
            if result:
                return json.dumps({"success": True, "message": "Message was added", "data": []}), 200
            else:
                return json.dumps({"success": False, "message": "Could not add message", "data": []}), 500
        else:
            return json.dumps({"success": False, "message": "Too long message!!", "data": []}), 200

    else:
        return json.dumps({"success": False, "message": "Invalid data", "data": []}), 500


@app.route('/check_token', methods = ['PUT'])
def check_token():
    json_data = request.json
    hash = request.headers['Authorization']
    data = json_data['email']
    profile_image = database_helper.get_profile_image(data)
    if not validate(hash, json_data['email'], "/check_token", data):
        return json.dumps({"success": False, "message": "Invalid token", "data": []}), 500

    return json.dumps({"success": True, "message": "Valid token", "data": [profile_image]}), 200
