# ROS Extension for Scratch 3

![animation](https://user-images.githubusercontent.com/20625381/50626217-58147400-0f70-11e9-81ae-71d00fd18982.gif)

An extension to connect [Scratch 3](https://en.scratch-wiki.info/wiki/Scratch_3.0) to [ROS](http://wiki.ros.org/) enabled platforms!

Supports:
- publishing and subscribing topics
- calling services
- getting and setting rosparam variables

## About

This extension packs with utility blocks for creating and manipulating [JSON objects](https://www.w3schools.com/js/js_json_objects.asp), which are integrated to Scratch variables and used to represent ROS messages.

When communicating with the ROS interface, message types are mostly infered by the topic or service name, being occluded from the user. This way the user do not need to worry that much about types, allowing easier and more intuitive usage of this extension.

This also means, however, that this extension doesn't do well in advertising new topics or serving services. Maybe these will be supported in future releases, but for now Scratch interface is designed to act as a ROS **client**, publishing to topics and called nodes already advertised by some other node, which should be responsible to handle the message from Scratch and do all of the robotics stuff.

## Quick Start
0. [Install ROS](http://wiki.ros.org/ROS/Installation) and the following dependencies. Ths project was tested on ROS1 (kinetic, melodic, noetic).
```bash
# Install main dependencies
sudo apt install ros-kinetic-rosbridge-server
# Install examples dependencies
sudo apt install ros-kinetic-turtlesim ros-kinetic-actionlib-tutorials 
```

1. Access http://www.scratch3ros.com . The extension currently doesn't support https access!

2. Open a terminal and fire up the following command
```
roslaunch rosbridge_server rosbridge_websocket.launch
```

3. Add the `ROS Extension` from the bottom left button and input `localhost` as the master URI

## Examples

Examples can be found at the [examples directory](https://github.com/Affonso-Gui/scratch3-ros-vm/tree/develop/src/extensions/scratch3_ros/examples). To run the examples:

1. On a terminal, launch `roslaunch rosbridge_server rosbridge_websocket.launch`
2. Access http://www.scratch3ros.com/ and load the example file
3. Use `localhost` as the master URI. If a warning sign appears near the ROS blocks, click it to reconnect.
![warning](https://user-images.githubusercontent.com/20625381/50582008-55e3e400-0ea2-11e9-942e-496bda7c557a.png)
4. Check comments for other required nodes
5. Click the green flag to start!

Simple chatter:
![scratch3ros_rosext_chatter](https://user-images.githubusercontent.com/20625381/193435672-27b23575-801a-4c63-947e-d148fadb8b5b.png)
Simple actionlib client:
![scratch3ros_rosext_fibonacci](https://user-images.githubusercontent.com/20625381/193435676-569b8dad-64b3-4afb-9581-8d5bb77f673b.png)
Turtlesim:
![scratch3ros_rosext_turtlesim](https://user-images.githubusercontent.com/20625381/193437783-54b3aed3-8b38-48ed-a359-ba497d4b727e.png)

## Blocks API

Details of provided blocks can be found at [BLOCKS.md](https://github.com/Affonso-Gui/scratch3-ros-vm/blob/develop/src/extensions/scratch3_ros/BLOCKS.md).


## Run from Source

Git clone the repositories below and follow instructions at https://github.com/LLK/scratch-gui/wiki/Getting-Started
- https://github.com/Affonso-Gui/scratch3-ros-gui
- https://github.com/Affonso-Gui/scratch3-ros-vm
- https://github.com/Affonso-Gui/scratch3-ros-parser

For a quick overview:
```bash
git clone https://github.com/Affonso-Gui/scratch3-ros-gui
git clone https://github.com/Affonso-Gui/scratch3-ros-vm
git clone https://github.com/Affonso-Gui/scratch3-ros-parser
cd scratch3-ros-parser && npm install && npm link
cd ../scratch3-ros-vm && npm install && npm link
cd ../scratch3-ros-gui && npm install && npm link scratch-parser scratch-vm
npm start
```

The current version have been tested with npm 9.8.1 and node 18.18.0.

## Develop a library for your own robot

You can include Scratch3-ROS on your Scratch project and create custom block libraries for your own robot. Multiple examples are given in the `jsk_robot` branch:
- https://github.com/Affonso-Gui/scratch3-ros-vm/tree/jsk_robots
- https://github.com/Affonso-Gui/scratch3-ros-gui/tree/jsk_robots
