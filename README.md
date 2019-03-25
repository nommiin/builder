# builder
(~~**NOTE:** At the moment, builder relies of features not avaliable in the release build of GMEdit as of 03/23/2019. It is suggested that you download and build GMEdit yourself to ensure plugin compatiblity, reccomended commit is f727ebb~~)

A work in progress GMEdit plugin that allows for testing Windows VM GMS 2 projects from inside GMEdit by invoking GMAssetCompiler

![screenshot](https://i.imgur.com/9ne0FRv.png)

# progress
The game can currently compile projects using the default configuration... at least on my system

# todo/goals
* ~~display output of GMAssetCompiler and Runner inside of GMEdit (likely will use a new code editor tab for this)~~ (added with v0.2)
* ~~add support for configurations that are passed to GMAssetCompiler ([wip](https://i.imgur.com/LYAq1Rq.png))~~ (added with v0.2)
* add support for building YYC projects
* add support for building for other platforms
* add a "clean project" button
* add a "stop project" button to stop running game or compiler
* add a "fork game" button to run multiple instances of game
* support GMS 1 projects? (unlikely)

# usage
1. create a folder named "builder" inside of `%appdata%/AceGM/GMEdit/plugins/`
2. extract `main.js`, `build.js`, and `config.json` into aforementioned folder
3. launch GMEdit and open a project
4. open the main menu and select "Run Project"
5. optional: adjust what runtime to use in the "Preferences" menu

# thanks
* YellowAfterlife for accepting my pull requests for adding in plugin events that made this easier to develop
