---
### ⚠️ heads up! ⚠️
i haven't been able to find much time to work on this plugin... so it's fallen behind quite a bit. luckily, yellowafterlife made a fork of the plugin that introduces numerous improvements and bug fixes. i'd heavily suggest downloading this fork and using it over this repository.

### [YAL-GMEdit/builder](https://github.com/YAL-GMEdit/builder)
### [YAL-GMEdit/builder](https://github.com/YAL-GMEdit/builder)
### [YAL-GMEdit/builder](https://github.com/YAL-GMEdit/builder)

---

# builder
![screenshot](https://i.imgur.com/vBhrrvR.png)

# about
builder was made to make [GMEdit](https://yellowafterlife.itch.io/gmedit) usable without the need of having GameMaker Studio 2 open in the background to compile projects. builder works by using your pre-existing settings made by GMS 2 to pass arguments into GMAssetCompiler and compile your project. builder was developed with faster development in mind, skipping most file generation and secondary applications being required to compile. builder even supports switching the runtime that you build your project with as well as compiling the project as it's already running! You can download a pre-packaged version of builder from [here!](https://github.com/nommiin/builder/releases)

If you found the plugin useful, consider donating to help support development on [itch.io!](https://nommiiin.itch.io/builder)

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

# help
* **my game compiles but doesn't open:** make sure you are using the correct runtime, as the default runtime is likely to be the oldest runtime you have downloaded
* **an error occurs in GMEdit but not in GMS 2:** again, this is likely an issue with the default runtime that builder selects. be sure to check and make sure that the runtime builder is using is the same as in GMS 2

# thanks
* [YellowAfterlife](https://twitter.com/YellowAfterlife) for accepting PRs that help the core functionality of this plugn, answering my endless questions, submitting PRs that help improve the plugin, and providing the screenshot used in the readme
* [Sidorakh](https://github.com/sidorakh/) for testing and supporting the plugin
* [Katie](https://twitter.com/347online) for encouraging me to add macOS support to the plugin
