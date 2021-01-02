const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const {
  generateMessage,
  generatedLocationMessage,
} = require("./utils/messages");

const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");

const express = require("express");
const app = express();
const server = http.createServer(app);
const io = socketio(server);
const Filter = require("bad-words");

const port = process.env.PORT || 3000;

const publicDirectoryPath = path.join(__dirname, `../public`);

app.use(express.static(publicDirectoryPath));

let welcomeMessage = "Welcome to the chat app";

io.on("connection", (socket) => {
  console.log("new websocket connection");

  socket.on("join", (options, callback) => {
    const { error, user } = addUser({
      id: socket.id,
      ...options,
    });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    socket.emit("message", generateMessage("Admin", "Welcome!"));
    socket.broadcast
      .to(user.room)
      .emit(
        `message`,
        generateMessage(`${user.username} has just joined the lobby`)
      );

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed");
    }
    io.to(user.room).emit(
      "message",
      generateMessage(user.username, message)
    );
    callback();
  });

  socket.on("sendLocation", (message, callback) => {
    const user = getUser(socket.id);
    socket.broadcast
      .to(user.room)
      .emit(
        `locationMessage`,
        generatedLocationMessage(
          user.username,
          `https://google.com/maps?q=${message.latitude},${message.longitude}`
        )
      );
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessage("Admin", `${user.username} has left!`),
        io.to(user.room).emit("roomData", {
          room: user.room,
          users: getUsersInRoom(user.room),
        })
      );
    }
  });
});

server.listen(port, () => {
  console.log(`server is up on port ${port}!`);
});
