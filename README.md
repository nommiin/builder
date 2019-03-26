# builder
![screenshot](https://i.imgur.com/eift2aO.png)

# about
builder was made to make [GMEdit](https://yellowafterlife.itch.io/gmedit) usable without the need of having GameMaker Studio 2 open in the background to compile projects. builder works by using your pre-existing settings made by GMS 2 to pass arguments into GMAssetCompiler and compile your project. builder was developed with faster development in mind, skipping most file generation and secondary applications being required to compile. builder even supports switching the runtime that you build your project with as well as compiling the project as it's already running! You can download a pre-packaged version of builder from [here!](https://github.com/nommiin/builder/releases)

# usage
1. create a folder named "builder" inside of `%appdata%/AceGM/GMEdit/plugins/` on Windows, `/Users/<username>/Library/Application Support/AceGM/GMEdit/plugins` on macOS
2. extract `main.js`, `build.js`, and `config.json` into aforementioned folder
3. launch GMEdit and open a project
4. open the main menu and select "Run Project"
5. optional: adjust what runtime to use in the "Preferences" menu

# todo/goals
* a "clean project" button
* more compiler customization (worker threads, verbose output, etc)
* in-editor progress bar, based on what GMAssetCompiler is doing
* support GMS 1 projects? (unlikely)
* refactor entirety of `build.js`, it's too messy!

# thanks
* [YellowAfterlife](https://twitter.com/YellowAfterlife) for accepting PRs that help the core functionality of this plugn and answering my endless questions
* [Sidorakh](https://github.com/sidorakh/) for testing and supporting the plugin
* [347_Jake](https://twitter.com/347_Jake) for encouraging me to add macOS support to the plugin
