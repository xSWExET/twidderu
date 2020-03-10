create table users(email varchar(50), password varchar(50),
                  firstName varchar(30), familyName varchar(40),
                  gender varchar(20), city varchar(100),
                  country varchar(100), profileImage varchar(100),
                  primary key(email));

create table messages(messageTo varchar(50), messageFrom varchar(50), message varchar(300), foreign key(messageTo) references users(email));

create table tokens(email varchar(50), token varchar(100), foreign key(email) references users(email));
