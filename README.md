# OSReboun.io

This is the repo for reboun.io.

I had a lot of fun making this game! The core gameplay isn't incredibly replayable (or addictive), and the lobby system segments your playerbase in a very bad way. If I ever make a game again I'm going to change a lot. It was very cool, having something I made used a lot - to date there have been 42,000 plays. The power of game aggregators I guess!

Some of the code base is very bad, as towards the end I was just hacking functionality in (this is mostly the front-end, the back-end is quite good.)

# notes

There are some optimisations that can be done and I've recognised portability in 'movement based' multiplayer games.
I've started writing a library (or at least a base template for these types of games) that I'll release when/if it's done. 

It seems the server can handle at least 50 players (on a $5 per month digital ocean droplet) - I haven't had more concurrent players than this. With optimisations from my library I suspect it could push 100.

# Setting up dev

Make sure you have node.js installed, git installed, a text/code editor of your choice (eg vs code)
links: https://nodejs.org/en/ https://git-scm.com/book/en/v2/Getting-Started-Installing-Git https://code.visualstudio.com/download

Open a command prompt
Navigate to the directory you wish to store the project in
run "git clone https://github.com/MCArth/fightr.git"
navigate into the directory it was cloned into (eg "cd fightr")
This is the root of the project

To run the project, 
run "npm i"
run "gulp"
run "mkdir data"
then
run "node src/server/server.js"
To test, navigate to localhost:3000
To test on your local network (aka have a computer other than the one you're running the game server on join) you may have to create a firewall rule for port 3000 (windows firewall), or just turn it off (not recommended, remember to turn it back on) (google for detailed instructions)
To test externally, you'll have to port forward by creating a rule on your router, their settings are usually available at 192.168.0.1 (google for detailed instructions)

# Contributing

If you feel like cleaning up some code, or want to add anything small, feel free.
If you want to make big changes to the gameplay, just fork the repo.

# How it works

Play the game to get a feel of the gameplay. In short, you walk over teammates to revive them and race to the end.

Yes, there are bots. Bots are replays of previous players who had beat that map (how they moved it stored and then the bot uses those movements).
There are two bots for every human, to balance out voting in the lobby.

You'll notice I have some analytics 

# About the code base

Server code is all contained in src/server. Entrypoint is server.js.
Client code is in src/client/clientjs/js/app.js (don't ask, this was a hack to get gulp running quickly)
Database is LevelDB, a simple string based key value store.


Backend/server:

There is a set of games. Each game has a list of rooms and users. Each room has a list of enemies, food and users.
Bots: bots are a player object, just like humans.
Time complexity of server tick: it's supposed to be O(klogn) (k is num players, n is number objects in a player's room) because I'm using a quadtree for collisions. 
I accidently made it O(kn) by not using the quadtree to narrow down the objects to send to the client. This is an easy fix, but I haven't got round to doing it.

Frontend:
Everything is in app.js!
Sorry. See notes - I've rewritten the front-end for a template/library.
