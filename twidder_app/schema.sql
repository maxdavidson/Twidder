DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
  firstname      TEXT  NOT NULL,
  familyname     TEXT  NOT NULL,
  email          TEXT  PRIMARY KEY  NOT NULL,
  gender         TEXT  NOT NULL,
  city           TEXT  NOT NULL,
  country        TEXT  NOT NULL,
  password_hash  TEXT  NOT NULL
);

DROP TABLE IF EXISTS Messages;
CREATE TABLE Messages (
  writer     TEXT      NOT NULL,
  recipient  TEXT      NOT NULL,
  timestamp  DATETIME  DEFAULT CURRENT_TIMESTAMP  NOT NULL,
  content    TEXT      NOT NULL,
  FOREIGN KEY (writer) REFERENCES Users(email),
  FOREIGN KEY (recipient) REFERENCES Users(email)
);

DROP TABLE IF EXISTS ActiveUsers;
CREATE TABLE ActiveUsers (
  user        TEXT      NOT NULL,
  token_hash  TEXT      NOT NULL  UNIQUE,
  expiration  DATETIME  NOT NULL,
  FOREIGN KEY (user) REFERENCES Users(email)
);