var currentUserEmail; // Email of the logged in user, initialized at login
var visitedUserEmail; // Email that the logged in user searches for in browse,
                      // initialized in searchProfile

var image_types = ['png', 'jpg', 'jpeg', 'gif'];
var video_types = ['mp4', 'webm', 'ogg'];



/*
 * This function is always called when the window is loaded, and when we log in
* or sign out a user. If a token exists we display the profile page
* corresponding to that token, otherwise we display the Welcome view
*/
displayView = function() {
  //the code required to display a view
  if (localStorage.getItem("token") == null) {
    document.getElementById("contentDiv").innerHTML = document.getElementById("welcomeView").innerHTML;
  }
  else {
    var emailJson = {
      'email': currentUserEmail
    };

    var token = localStorage.getItem("token");
    var hash_value = sha256.hmac(token, token + "/check_token" + emailJson['email']);

    var req = new XMLHttpRequest();
    req.open("PUT", "/check_token", true);
    req.setRequestHeader("content-type", "application/json");
    req.setRequestHeader("Authorization", hash_value);
    req.onreadystatechange = function() {
      if (req.readyState == 4) {
        if (req.status == 200) {
          var response = JSON.parse(req.responseText);
          if (response.success) {
            createWebSocket();
            document.getElementById("contentDiv").innerHTML = document.getElementById("profileView").innerHTML;
            document.getElementById("badChangePassword").style.color = "red";
            openTab(null, "home");
            updateProfile(true);
            updateProfilePic(true);
          }
          else {
            document.getElementById("contentDiv").innerHTML = document.getElementById("welcomeView").innerHTML;
            document.getElementById("badSignup").style.color = "red";
            localStorage.removeItem("token");
          }
        }
        else if (req.status == 500){
          document.getElementById("contentDiv").innerHTML = document.getElementById("welcomeView").innerHTML;
          localStorage.removeItem("token");
        }
        else {
          console.log("Error status: " + req.status);
        }
      }
    }
    req.send(JSON.stringify(emailJson));
  }
};

/*
 * Automatically called when a page is loaded
 */
window.onload = function() {
  currentUserEmail = localStorage.getItem("user_email");
  displayView();
};

/*
 * Changes the user's password by first validating the input and then
 * calling the respective function in serverstub
 */
changePassword = function(form) {
  var isValidated = true;
  document.getElementById("badChangePassword").style.color = "red";

  if (form.oldPassword.value.length < 7) {
    document.getElementById("badChangePassword").innerHTML = "Old password is too short";
    isValidated = false;
  }
  else if (form.newPassword.value.length < 7) {
    document.getElementById("badChangePassword").innerHTML = "New password is too short";
    isValidated = false;
  }
  else if (form.repeatPassword.value != form.newPassword.value) {
    document.getElementById("badChangePassword").innerHTML = "New passwords don't match";
    isValidated = false;
  }

  if (isValidated) {

    var passwordData = {
      "email" : currentUserEmail,
      "oldPassword" : form.oldPassword.value,
      "newPassword" : form.newPassword.value
    };

    var token = localStorage.getItem("token");
    var hash_value = "";
    var data = "";
    for (var item of Object.values(passwordData)) {
      data += item;
    }
    hash_value = sha256.hmac(token, token + "/change_password" + data);

    var req = new XMLHttpRequest();
    req.open("PUT", "/change_password", true);
    req.setRequestHeader("content-type", "application/json");
    req.setRequestHeader("Authorization", hash_value);
    req.onreadystatechange = function() {
      if (req.readyState == 4) {
        if (req.status == 200) {
          var response = JSON.parse(req.responseText);
          if (response.success) {
            document.getElementById("badChangePassword").style.color = "green";
          }
          document.getElementById("badChangePassword").innerHTML = response.message;
        }
        else {
          console.log("Error status: " + req.status);
        }
      }
    }
    req.send(JSON.stringify(passwordData));
  }

}

/*
 * Is called when the user clicks on a tab where 'tabName' is the name of the tab that was clicked
 * It both changes the color of the tabs and changes the display view
 */
openTab = function(evt, tabName) {
  var tabs = document.getElementsByClassName("tab");
  for (i=0; i<tabs.length; i++) {
    tabs[i].style.display = "none";
  }
  document.getElementById(tabName).style.display = "block";

  tabButtons = document.getElementsByClassName("tabButtons");
  for (i = 0; i < tabButtons.length; i++) {
    tabButtons[i].className = tabButtons[i].className.replace(" buttonPressed", "");
  }

  // If evt is null, it means that this function has been called by displayView
  // at page reload, and not by the user clicking a tab
  if (evt != null) {
    // Add the class buttonPressed to the clicked tab (used for CSS styling)
    evt.currentTarget.className += " buttonPressed";
  }
  else {
    // Add the class buttonPressed to the home tab
    document.getElementById("homeTab").className += " buttonPressed";
  }
}

/*
 * Checks if the data input for signing up a user is valid.
 * If so the signUpUser function is called
 */
validateSignup = function(form) {
  var isValidated = true;

  if (form.password.value.length < 7) {
    document.getElementById("badSignup").innerHTML = "Password is too short";
    isValidated = false;

  }
  else if (form.repeatpsw.value != form.password.value) {
    document.getElementById("badSignup").innerHTML = "Passwords don't match";
    isValidated = false;
  }

  if (isValidated) {
    signUpUser(form);
  }
}

/*
 * Checks if the data input for login in a user is valid.
 * If so the loginUser function is called
 */
validateLogin = function(form) {
  var isValidated = true;
  if (form.password.value.length < 7) {
    document.getElementById("badLogin").innerHTML = "Password is too short";
    isValidated = false;
  }

  if (isValidated) {
    loginUser(form);
  }
}

createWebSocket = function() {
  console.log("Function called");
  if ("WebSocket" in window) {
    console.log("Creating socket");
    ws = new WebSocket("ws://" + document.domain + ":5000/api");
    ws.onopen = function(evt) {
      console.log("We have connected to the server");
      ws.send(localStorage.getItem("token"));
    };
     ws.onmessage = function(msg) {
      localStorage.removeItem("token");
      displayView();
    }
    ws.onclose = function() {
      console.log("Closing");
    }
  }
}

saveCookie = function() {
  token = localStorage.getItem("token");
  hash_value = sha256.hmac(token, token + "/upload_file" + currentUserEmail);
  document.cookie = 'hash_value='+hash_value;
  document.cookie = 'email='+currentUserEmail;

}

/*
 * Is called after the data has been validated. Calls the signIn function from
 * serverstub and changes display view if the login is a success. Also stores the token
 */
loginUser = function(form) {

  var user = {
    "email" : form.email.value,
    "password" : form.password.value
  };

  var req = new XMLHttpRequest();
  req.open("PUT", "/sign_in", true);
  req.setRequestHeader("content-type", "application/json");
  req.onreadystatechange = function() {
    if (req.readyState == 4) {
      if (req.status == 200) {
        var response = JSON.parse(req.responseText);
        if (response.success) {
          console.log(response.data[0]);
          localStorage.setItem("user_email", form.email.value);
          localStorage.setItem("token", response.data[0]);

          currentUserEmail = form.email.value;
          console.log("På dig");
          displayView();
        }
        else {
          document.getElementById("badLogin").innerHTML = response.message;
        }
      }
      else {
        console.log("Error status: " + req.status);
      }
    }
  }
  req.send(JSON.stringify(user))
}

updateProfilePic = function(isOwnPage) {

    var token = localStorage.getItem("token");
    var req = new XMLHttpRequest();
    if (isOwnPage) {
      req.open("GET", "/update_profile_pic" + currentUserEmail, true);
      hash_value = sha256.hmac(token, token + "/update_profile_pic" + currentUserEmail);
    }
    else {
      req.open("GET", "/update_visited_profile_pic" + currentUserEmail + "/" + visitedUserEmail, true);
      hash_value = sha256.hmac(token, token + "/update_visited_profile_pic" + currentUserEmail + visitedUserEmail);
    }

    req.setRequestHeader("Authorization", hash_value);
    req.onreadystatechange = function() {
      if (req.readyState == 4) {
        if (req.status == 500) {
          console.log("Error");
        }
        else {
          var response = JSON.parse(req.responseText);
          console.log(response);
          console.log(response.data);
          var type = getType(response.data);

          if (isOwnPage) {
            if (image_types.includes(type)) {
              document.getElementById("profileImage").innerHTML = "<image width=320 height=240 src="+response.data+">";
            }
            else if(video_types.includes(type)) {
              document.getElementById("profileImage").innerHTML = "<video class=\"whiteBorderBox\" width=320 height=240 \
                                                                  autoplay muted loop><source src="+response.data+" type=video/"+type+"></video>"
            }
          }
          else {
            if (image_types.includes(type)) {
              document.getElementById("visitedProfileImage").innerHTML = "<image width=320 height=240 src="+response.data+">";
            }
            else if(video_types.includes(type)) {
              document.getElementById("visitedProfileImage").innerHTML = "<video class=\"whiteBorderBox\" width=320 height=240 \
                                                                  autoplay muted loop><source src="+response.data+" type=video/"+type+"></video>"
            }
          }

        }

      }
    }
    req.send()
}


getType = function(filename) {
    var arr = filename.split('.');
    return arr[arr.length-1];
}


/*
 * Updates the user info and also calls the updateWall function
 * If 'isOwnPage' is true then it updates the content on the home tab
 * Otherwise it updates the content on the browse tab.
 */
updateProfile = function(isOwnPage) {

  var req = new XMLHttpRequest();

  var token = localStorage.getItem("token");
  var hash_value = "";
  // Depending on what tab we are on (home or browse) we call for different functions
  if (isOwnPage) {
    req.open("GET", "/get_private_data" + currentUserEmail, true);
    hash_value = sha256.hmac(token, token + "/get_private_data" + currentUserEmail);
  }
  else {
    req.open("GET", "/get_visited_data" + currentUserEmail + "/" + visitedUserEmail, true);
    hash_value = sha256.hmac(token, token + "/get_visited_data" + currentUserEmail + visitedUserEmail);
  }

  // Hash the token by using token as key and the HTTP data as salt
  // send the hash in the authorization header
  req.setRequestHeader("Authorization", hash_value);
  req.onreadystatechange = function() {
    if (req.readyState == 4) {
      if (req.status == 200) {
        var response = JSON.parse(req.responseText);
        if (response.success) {
          var profileInfo = "";

          index = 0;
          for (var info of Object.values(response.data[0])) {
            profileInfo += "<li><b>"+addProfileInfoType(index)+"</b>" + info + "</i> ";
            index++;
          }

          // Depending on if we are on our own page or not we display the data on our home tab or the browse tab
          if (isOwnPage) {
            document.getElementById("personalInfoList").innerHTML = profileInfo;
            currentUserEmail = response.data[0]['email'];
          }
          else {
            document.getElementById("searchErrorMessage").style.display = "none";
            document.getElementById("displayBrowseProfile").style.display = "block";
            document.getElementById("visitedPersonalInfoList").innerHTML = profileInfo;
          }

          // Update the home tab wall or the browse tab wall
          updateWall(isOwnPage);
        }
        // If we are on the browse tab and the request was not succesful then we display error msg on the browse tab
        else if (!isOwnPage) {
          document.getElementById("displayBrowseProfile").style.display = "none";
          document.getElementById("searchErrorMessage").style.display = "block";
          document.getElementById("searchErrorMessage").innerHTML = "User does not exist";
        }
        else {
          console.log(response.message);
        }
      }
      else {
        console.log("Error status: " + req.status);
      }
    }
  }
  req.send()
}

/*
 * Is used in the updateProfile function to add some text of what type of
 * personal info that is shown in the profileInfoList
 */
addProfileInfoType = function(index) {
  textToReturn = "";
  switch(index) {
    case 0:
      textToReturn = "Email: ";
      break;
    case 1:
      textToReturn = "First name: ";
      break;
    case 2:
      textToReturn = "Family name: ";
      break;
    case 3:
      textToReturn = "Gender: ";
      break;
    case 4:
      textToReturn = "City: ";
      break;
    case 5:
      textToReturn = "Country: ";
      break;
    default:
      textToReturn = "ERROR: ";
  }
  return textToReturn;
}

/*
 * Updates and fills the wall of messages by calling the serverstub
 * If 'isOwnPage' is true then it updates the wall on the home tab
 * Otherwise it updates the wall on the browse tab.
 */
updateWall = function(isOwnPage) {
  var req = new XMLHttpRequest();

  var token = localStorage.getItem("token");
  var hash_value = "";
  // Depending on what tab we are on (home or browse) we call for different functions
  if (isOwnPage) {
    req.open("GET", "/get_private_messages" + currentUserEmail, true);
    hash_value = sha256.hmac(token, token + "/get_private_messages" + currentUserEmail);
  }
  else {
    req.open("GET", "/get_visited_messages" + currentUserEmail + "/" +  visitedUserEmail, true);
    hash_value = sha256.hmac(token, token + "/get_visited_messages" + currentUserEmail + visitedUserEmail);
  }

  req.setRequestHeader("Authorization", hash_value);
  req.onreadystatechange = function() {
    if (req.readyState == 4) {
      if (req.status == 200) {
        var response = JSON.parse(req.responseText);
        if (response.success) {
          var wallText = "";
          for (var item of Object.values(response.data)) {
            wallText += "<li class=\"message\">" + item + "</i><br> ";
          }

          // We update the message wall on either the home tab or the browse tab
          if (isOwnPage) {
            document.getElementById("postedMessagesList").innerHTML = wallText;
          }
          else {
            document.getElementById("visitedPostedMessagesList").innerHTML = wallText;
          }

        }
        else {
          console.log(response.message);
        }
      }
      else {
        console.log("Error status: " + req.status);
      }
    }
  }
  req.send()
}

/*
 * Is called after the data has been validated. Calls the signUp function from serverstub
 * It creates a object with the input data and calls the signUp function with returns a true or false success.
 */
signUpUser = function(form) {
  var userObject = {
    'email': form.email.value,
    'password': form.password.value,
    'firstName': form.firstName.value,
    'familyName': form.familyName.value,
    'gender': form.gender.value,
    'city': form.city.value,
    'country': form.country.value
  };


  var req = new XMLHttpRequest();
  req.open("PUT", "/sign_up", true);
  req.setRequestHeader("content-type", "application/json");
  req.onreadystatechange = function() {
    if (req.readyState == 4) {
      if (req.status == 200) {
        var response = JSON.parse(req.responseText);
        if (response.success) {
          document.getElementById("badSignup").style.color = "green";
          document.getElementById("badSignup").innerHTML = "User created";
        }
        else {
          document.getElementById("badSignup").style.color = "red";
          document.getElementById("badSignup").innerHTML = response.message;
        }
      }
      else {
        console.log("Error status: " + req.status);
      }
    }
  }
  req.send(JSON.stringify(userObject))

}

/*
 * Signs out the user by first calling the signOut function in serverstub and then
 * removing the token from the localStorage. By then calling displayView it will
 * change to the welcomeView because the token is null
 */
signOut = function() {

  var emailJson = {
    'email': currentUserEmail
  };

  var token = localStorage.getItem("token");
  var hash_value = sha256.hmac(token, token + "/sign_out" + emailJson['email']);

  var req = new XMLHttpRequest();
  req.open("PUT", "/sign_out", true);
  req.setRequestHeader("content-type", "application/json");
  req.setRequestHeader("Authorization", hash_value);
  req.onreadystatechange = function() {
    if (req.readyState == 4) {
      if (req.status == 200) {
        var response = JSON.parse(req.responseText);
        if (response.success) {
          localStorage.removeItem("token");
          displayView();
        }
        else {
          console.log(response.message);
        }
      }
      else {
        console.log("Error status: " + req.status);
      }
    }
  }
  req.send(JSON.stringify(emailJson))
}

uploadFile = function(form) {
  var req = new XMLHttpRequest();
  req.open("POST", "/upload_file", true);
  var file = {"file": form.file.value};
  var fileName = form.file.name
  console.log(fileName)
  var mimeType = "multipart/form-data"
  //req.setRequestHeader("Authorization", hash_value);
  req.setRequestHeader("content-type", mimeType);
  req.setRequestHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
  req.onreadystatechange = function() {
    if (req.readyState == 4) {
      if (req.status == 200) {
        var response = JSON.parse(req.responseText);
        if (response.success) {
          console.log("Great success");
        }
        else {
          console.log("Epic fail");
        }
      }
      else {
        console.log("Error status: " + req.status);
      }
    }
  }
  req.send(JSON.stringify(file));

}

/*
 * Called when the user posts a message on either their own wall or someone else's.
 * Posts a message to the wall by calling the serverstub postMessage function and
 * then updates the wall
 */
postMessage = function(form, isOwnPage) {
  if (isOwnPage) {
    var messageObject = {
      'user_email': currentUserEmail,
      'target_email': currentUserEmail,
      'message': form.postText.value
    };

    var token = localStorage.getItem("token");
    var hash_value = "";
    var data = "";
    for (var item of Object.values(messageObject)) {
      data += item;
    }
    hash_value = sha256.hmac(token, token + "/post_message" + data);

    var req = new XMLHttpRequest();
    req.open("PUT", "/post_message", true);
    req.setRequestHeader("content-type", "application/json");
    req.setRequestHeader("Authorization", hash_value);
    req.onreadystatechange = function() {
      if (req.readyState == 4) {
        if (req.status == 200) {
          var response = JSON.parse(req.responseText);
          if (response.success) {
            document.getElementById('postText').value='';
            updateWall(true);
          }
          else {
            console.log(response.message);
          }
        }
        else {
          console.log("Error status: " + req.status);
        }
      }
    }
    req.send(JSON.stringify(messageObject));

  }
  else {
    var messageObject = {
      'user_email': currentUserEmail,
      'target_email': visitedUserEmail,
      'message': form.postTextOthers.value
    };

    var token = localStorage.getItem("token");
    var hash_value = "";
    var data = "";
    for (var item of Object.values(messageObject)) {
      data += item;
    }
    console.log(data);
    hash_value = sha256.hmac(token, token + "/post_message" + data);


    var req = new XMLHttpRequest();
    req.open("PUT", "/post_message", true);
    req.setRequestHeader("content-type", "application/json");
    req.setRequestHeader("Authorization", hash_value);
    req.onreadystatechange = function() {
      if (req.readyState == 4) {
        if (req.status == 200) {
          var response = JSON.parse(req.responseText);
          if (response.success) {
            document.getElementById('postTextOthers').value='';
            updateWall(false);
          }
          else {
            console.log(response.message);
          }
        }
        else {
          console.log("Error status: " + req.status);
        }
      }
    }
    req.send(JSON.stringify(messageObject));
  }
}

/*
 * Called when the user searches for a user in the browse tab. Sets the value
 * of visitedUserEmail and then calls updateProfile in order to display the correct
 * user profile
 */
var searchProfile = function(form) {
  visitedUserEmail = form.searchText.value;
  updateProfile(false);
  updateProfilePic(false);
}
