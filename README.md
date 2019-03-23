# builder
A work in progress GMEdit plugin that allows for building GMS 2 projects from inside GMEdit by invoking GMAssetCompiler

# progress
The game can currently compile projects using the default configuration... at least on my system

# todo/goals
* display output of GMAssetCompiler and Runner inside of GMEdit (likely will use a new code editor tab for this)
* add support for configurations that are passed to GMAssetCompiler ([wip](https://i.imgur.com/LYAq1Rq.png))
* support GMS 1 projects? (unlikely)

# usage
1. create a folder named "builder" inside of `%appdata%/AceGM/GMEdit/plugins/`
2. extract `main.js`, `build.js`, and `config.json` into aforementioned folder
3. launch GMEdit and open a project
4. open the main menu and select "Run Project"
5. optional: adjust what runtime to use in the "Preferences" menu

# thanks
* YellowAfterlife for accepting my pull requests for adding in plugin events that made this easier to develop
