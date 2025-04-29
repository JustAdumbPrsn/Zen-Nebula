<h1 align="center">Nebula</h1>
<div align="center">
    <a href="https://zen-browser.app/">
        <img width="120" alt="zen-badge-dark" src="https://github.com/user-attachments/assets/d6ab3ddf-6630-4062-92d0-22497d2a3f9a" />
    </a>
</div>

###

<div align="center">
  <img src="https://i.ibb.co/ZRFXDBW2/Screenshot-2025-03-06-195221.png" width="800" />
</div>

###

<h2 align="left">✨What is Nebula?</h2>

###

<p align="left">Nebula is a minimal theme made for Zen Browser which adds a lot of new animations, glass-like blur, UI changes, and more. It is inspired by glassmorphism and minimal gradients.<br><br>This is my personal userChrome which I made to personalize Zen to my own liking. ❤️<br>If some of you don't like the design choices I made, you can edit the userChrome yourself if you know how to code, and if you don't, you can use ChatGPT to customize it as per your preference.</p>

###

<h2 align="left">🪐Showcase :))</h2>

<div align="center">
  <img src="https://github.com/user-attachments/assets/7dc9251f-2cba-445e-b100-9d1be8bd53e6" width="400">
  <img src="https://github.com/user-attachments/assets/361dc025-cb19-4982-a047-1e79f61042b8" width="400">
  <img src="https://github.com/user-attachments/assets/0a69ff9a-0226-452a-8bde-a21929f4a590" width="400">
  <img src="https://github.com/user-attachments/assets/12edfbbb-ca9d-41a5-9113-fd67276b9ac5" width="400">
  <img src="https://github.com/user-attachments/assets/06381256-4f99-41e9-a21e-22a29c3f481f" width="400">
  <img src="https://github.com/user-attachments/assets/5fa8923e-7a3d-471a-8256-1f72528926a4" width="400">
</div>

###

<h2 align="left">🫶🏻Thanks for the support!</h2>
<p align="center">
  <a href="https://www.star-history.com/#JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser&greeeen-dev/natsumi-browser&Date">
    <img src="https://api.star-history.com/svg?repos=JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser,greeeen-dev/natsumi-browser&type=Date" alt="Star History Chart" width="800">
  </a>
</p>



<p align="center">It is so crazy to me that Nebula has become one of the biggest mods for Zen Browser in such a short period of time! really appreciate it</p>

###

<h2 align="left">☄️ Installation:</h2>

###
**Quick note:** If you want a video tutorial for the installation process then it is there on a youtube video someone made about it: https://www.youtube.com/watch?v=ysXRr6GAsNc&t=9s

### Nix

This repo includes a Nix flake that exposes a home-manager module that installs Nebula for your Zen-browser declaratively.

To enable the module, add the repo as a flake input, import the module, and enable `zen-nebula`.

<details><summary>Install using your home-manager module defined within your `nixosConfigurations`:</summary>

```nix

  # flake.nix

  {

      inputs = {
         # ---Snip---
         home-manager = {
           url = "github:nix-community/home-manager";
           inputs.nixpkgs.follows = "nixpkgs";
         };

         zen-nebula.url = "github:JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser";
         # ---Snip---
      }

      outputs = {nixpkgs, home-manager, ...} @ inputs: {
          nixosConfigurations.HOSTNAME = nixpkgs.lib.nixosSystem {
            specialArgs = { inherit inputs; };
            modules = [
            home-manager.nixosModules.home-manager
              {
               # Must pass in inputs so we can access the module
                home-manager.extraSpecialArgs = {
                  inherit inputs;
                };
              }
           ];
        };
     }
  }
```
```nix

# home.nix

imports = [ inputs.zen-nebula.homeModules.default ];

zen-nebula = {
    enable = true;
    profile = "<firefox profile name here>";
};
```
</details>

###
<h3 align="left">1. Installing CSS</h3>

###

<p align="left">• If you have not already, follow the Zen Live Editing guide to first create your chrome folder: https://docs.zen-browser.app/guides/live-editing<br><br>• Download the chrome ZIP file from latest Release version and paste the Nebula folder inside the chrome folder and open your userChrome.css and add the line ➡️@import "Nebula/Nebula.css";⬅️ and then open your userContent.css (or make one) and add the line ➡️@import "Nebula/Nebula-content.css";⬅️ OR if you dont want to add this line to your userChrome & userContent.css then take the userChrome.css and userContent.css file provided in the ZIP file and directly paste that one into your chrome folder.<br><br>• Restart the browser to see if the UI has changed.<br><br>• Go to about:config in Zen and search for "browser.tabs.allow_transparent_browser". If the option is visible, set it to "true". If not, click the "+" icon and set it to "boolean".<br><br>• Install the wallpapers.zip from the latest release (optional) (optional)</p>

###

<h3 align="left">2. Customize Nebula through configs</h3>

###

<p align="left">• If you want different features like different styles of animations, different hover gradients like RGB, monochrome, or default presets, then go to your Nebula folder and open the newly added Nebula-config.css. There read through the different configuration options along with a guide on how to enable/disable them by going to about:config<br><br>• For example if you do not like the tab switch animation then you can change it to a different preset style or disable it completely! You could also change the roundness of the whole UI just by changing the default border radius value to your liking!</p>

###

<h3 align="left">3. Install Mica For Everyone (ONLY FOR WINDOWS 11 USERS)</h3>

###

<p align="left">• To get real backdrop filter transparency (note: that this method provides a better blur effect than the transparent zen extension by sameerasw), go to "https://github.com/MicaForEveryone/MicaForEveryone" and install the app.<br><br>• Click the "+ Add new Rule" at the bottom left and "Add process rule" for "zen".<br><br>• NOTE: If you have "Show Accent color on title bars and window borders" enabled in windows 11 settings, please disable it for transparency to work"
</p>
<img width="900" src="https://github.com/user-attachments/assets/e867a04e-a8ba-4795-bada-e22ca92fc657"  />

###

<div align="left">
  <img height="400" src="https://github.com/user-attachments/assets/34f6965c-1bdc-4ea1-8605-efde3b898d23"  />
</div>

###

<p align="left">• Change the Backdrop type to Acrylic and enable blur behind in advanced options.<br><br>• Restart Zen and see how it looks.</p>

###
<h3 align="left">3. Install kwin-effects-forceblur (ONLY FOR KDE LINUX)</h3>

###
<p align="left">• To get real backdrop filter transparency, go to "https://github.com/taj-ny/kwin-effects-forceblur" and install the app.<br><br>• It's required to install 'kwin-effects-forceblur' from AUR then go to System Settings -> Windows -> Desktop Effecs, disable Blur and enable Better Blur and in Better Blur settings go to 'Force blur' tab and add 'zen' to list of classes of windows. Here is the blur configuration: </p>

###

<div align="center">
  <img height="300" src="https://github.com/user-attachments/assets/8a19fcdd-acf9-4540-9833-ae0be3cce363"  />
</div>

###

<h3 align="left">4. Add the Firefox extension Bonjourrr</h3>

###

<p align="left">• Go to "https://addons.mozilla.org/en-US/firefox/addon/bonjourr-startpage/" and install this extension.<br><br>• The new tab must be replaced by this now. On the bottom right, you will see a settings button for new tab. Change the settings to these:</p>

###

<div align="center">
  <img height="300" src="https://github.com/user-attachments/assets/e7e27035-6e2b-4006-abf7-091a103536f9"  />
</div>

###

<div align="center">
  <img height="300" src="https://github.com/user-attachments/assets/d8fb107f-1247-4a3e-8026-619311e2dee5"  />
</div>

###

<div align="center">
  <img height="300" src="https://github.com/user-attachments/assets/724abcd8-a9f0-4d76-a054-3d76e3c7db60"  />
</div>

###

<p align="left">• In the section where it says "Add custom CSS", add this code:</p>

```css
@import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap');

body, h1, h2, h3, h4, h5, h6, p, span, div {
    font-family: 'Comfortaa', sans-serif !important;
    font-weight: 300 !important; /* Light weight for a sleek and modern feel */
    letter-spacing: 0.025em; /* Slight spacing for better readability */
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #e0e0e0; /* Soft white for a modern touch */
}

h1 {
    font-weight: 400 !important; /* Slightly bolder headlines */
    letter-spacing: 0.025em;
}

p {
    font-weight: 300 !important;
    line-height: 1.6;
    letter-spacing: 0.015em;
}

/* Optional: Add a soft glow effect for a smooth aesthetic */
p, h1, h2, h3 {
    text-shadow: 0 0 1px rgba(255, 255, 255, 0.2);
}
#background {background-image: none !important; background-color: transparent !important;}
   .tabbing {background-color: transparent !important;}
    body {background-color: transparent !important;}
```
###

<h3 align="left">5.  Using pinned extensions</h3>

###

<p align="left">• First pin an extension normally, it should be somewhere in the top bar like default zen<br><br>• Now, right click on the sidebar and go to customize toolbar mode, from there drag the extension from the top bar to above essentials (or you can say below the URLbar) it would look a bit weird but press save changes and it should look perfect<br><br>• In my personal opinion, place the bonjourr extension above essentials so you can easily open a new tab by clickin it</p>
<div align="center">
<img height="400" src="https://github.com/user-attachments/assets/8121a9a4-e8ed-4c4e-8ed0-92bd775438bb" />
</div>

###

<h3 align="left">6. Add the extension Zen Internet by Sameerasw (Optional)</h3>

###

<p align="left">• this extension makes web pages transparent<br>https://addons.mozilla.org/en-US/firefox/addon/zen-internet/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search</p>

###

<h2 align="left">Re-distribution info:</h2>

###

<p align="left">You are totally free to make forks of this or put this in your chrome file and create or modify it according to yourself. It is suggested to credit me if you use my theme. Thanks for using Nebula 🫶🏻</p>

###

<h2 align="left">Credits:</h2>

###

<h5 align="left">• https://github.com/Tanay-Kar/Lacuna<br><br>• https://github.com/greeeen-dev/natsumi-browser<br><br>• https://github.com/sameerasw/my-internet<br><br>• https://github.com/TheBigWazz/Pineapple-Fried<br><br>• https://github.com/TFFC-Anoms12/Advanced-Tab-Groups<br><br>------------------------------------------<br>Kindly let me know if i missed some :))</h5>

###

<h5 align="left"> NOTE: There might be some issues with this theme, please report them to me if you experience something unusual, i will try to fix/clarify it. Also this mod has only been tested by me on a windows 11 computer so if Linux and MacOS versions are not working properly then i can't really do anything about it :( </h5>
