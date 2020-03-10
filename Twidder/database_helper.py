import sqlite3
from flask import g

DATABASE_URI = 'database.db'

def get_db():
    db = getattr(g, 'db', None)
    if db is None:
        db = g.db = sqlite3.connect(DATABASE_URI)
    return db

def disconnect_db():
    db = getattr(g, 'db', None)
    if db is not None:
        g.db.close()
        g.db = None

def register_user(email, password, firstName, familyName, gender, city, country):
    try:
        get_db().execute('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', [email, password, firstName, familyName, gender, city, country, "default.jpg"])
        get_db().commit()
        return True
    except:
        return False

def set_profile_image(url, email):
    try:
        get_db().execute('UPDATE users SET profileImage = ? WHERE email = ?', [url, email])
        get_db().commit()
        return True
    except:
        return False

def get_profile_image(email):
    try:
        cursor = get_db().execute('SELECT profileImage FROM users WHERE email LIKE ?', [email])
        row = cursor.fetchone()
        cursor.close()
        return row[0]
    except:
        print("EXCEPT")
        return ""

def get_user_profile_data_email(email):
    try:
        cursor = get_db().execute('SELECT * FROM users WHERE email LIKE ?', [email])
        rows = cursor.fetchall()
        cursor.close()
        result = []
        for index in range(len(rows)):
            result.append({'email': rows[index][0], 'firstName': rows[index][2], 'familyName': rows[index][3],
                           'gender': rows[index][4], 'city': rows[index][5], 'country': rows[index][6]})
        if result == []:
            return None
        return result
    except:
        return None


def get_user_profile_data_token(token):
    try:
        user_email = get_email(token)
        return get_user_profile_data_email(user_email)
    except:
        return None

def get_user_password(user_email):
    try:
        cursor = get_db().execute('SELECT password FROM users WHERE email LIKE ?', [user_email])
        row = cursor.fetchone()
        cursor.close()
        return row[0]
    except:
        return None

def get_email(token):
    try:
        cursor = get_db().execute('SELECT email FROM tokens WHERE token LIKE ?', [token])
        row = cursor.fetchone()
        cursor.close()
        return row[0]
    except:
        return None

def get_token(email):
    try:
        cursor = get_db().execute('SELECT token FROM tokens WHERE email LIKE ?', [email])
        row = cursor.fetchone()
        cursor.close()
        return row[0]
    except:
        return None


def get_messages_token(token):
    try:
        user_email = get_email(token)
        return get_messages_email(user_email)
    except:
        return None

def get_messages_email(email):
    try:
        cursor = get_db().execute('SELECT message FROM messages WHERE messageTo LIKE ?', [email])
        rows = cursor.fetchall()
        cursor.close()
        result = []
        for index in range(len(rows)):
            result.append(rows[index][0])
        return result
    except:
        return None

def change_user_password(user_email, newPassword):
    try:
        get_db().execute('UPDATE users SET password = ? WHERE email = ?', [newPassword, user_email])
        get_db().commit()
        return True
    except:
        return False

def set_token(email, token):
    try:
        get_db().execute("INSERT INTO tokens VALUES(?,?);", [email, token])
        get_db().commit()
        return True
    except:
        return False


def remove_token(user_email):
    try:
        if (user_email == None):
            return False
        get_db().execute('DELETE FROM tokens WHERE email like ?', [user_email])
        get_db().commit()
        return True
    except:
        return False


def validate_token(token):
    try:
        cursor = get_db().execute('SELECT email FROM tokens WHERE token LIKE ?', [token])
        rows = cursor.fetchone()
        if (len(rows[0]) == 0):
            return False
        cursor.close()
        return True
    except:
        return False

def check_if_logged_in(email):
    try:
        cursor = get_db().execute('SELECT token FROM tokens WHERE email LIKE ?', [email])
        rows = cursor.fetchone()
        if (len(rows[0]) == 0):
            return False
        cursor.close()
        return True
    except:
        return False


def add_message(current_email, recipient_email, message):
    try:
        get_db().execute('INSERT INTO messages VALUES(?,?,?)', [recipient_email, current_email, message])
        get_db().commit()
        return True
    except:
        return False
