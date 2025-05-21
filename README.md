<h1 align="center">Nebula</h1>
<div align="center">
    <a href="https://zen-browser.app/">
        <img width="120" alt="zen-badge-dark" src="https://github.com/user-attachments/assets/d6ab3ddf-6630-4062-92d0-22497d2a3f9a" />
    </a>
</div>

###

<div align="center">
  <img src="https://github.com/user-attachments/assets/e09859a4-ad66-483e-be67-b25d11d54298" width="800" />
</div>

###

<h2 align="left">✨What is Nebula?</h2>

###

<p align="left">Nebula is a minimal theme made for Zen Browser which adds a lot of new animations, glass-like blur, UI changes, and more. It is inspired by glassmorphism and minimal gradients.<br><br>This is my personal userChrome which I made to personalize Zen to my own liking. ❤️<br>If some of you don't like the design choices I made, you can edit the userChrome yourself if you know how to code, and if you don't, you can use ChatGPT to customize it as per your preference.</p>

###

<h2 align="left">🪐Showcase :))</h2>

<div align="center">
  <img src="https://github.com/user-attachments/assets/6981d87f-8816-444b-a31e-7e12997c2bd6" width="400">
  <img src="https://github.com/user-attachments/assets/cc44bfda-c690-45b3-b147-1304b84ea07d" width="400">
  <img src="https://github.com/user-attachments/assets/b7065ad6-4162-4842-824a-79d4e5fcbd53" width="400">
  <img src="https://github.com/user-attachments/assets/61729dde-10ef-4738-b6cf-72720353dfb9" width="400">
  <img src="https://github.com/user-attachments/assets/8a5e3afd-e5f9-4f4a-8613-8c8843f68b9b" width="400">
  <img src="https://github.com/user-attachments/assets/78528ae5-f119-409b-b881-f69ade03d299" width="400">
</div>

###

<h2 align="left">🫶🏻Thanks for the support!</h2>
<p align="center">
  <a href="https://www.star-history.com/#JustAdumbPrsn/Zen-Nebula&greeeen-dev/natsumi-browser&Date">
    <img src="https://api.star-history.com/svg?repos=JustAdumbPrsn/Zen-Nebula,greeeen-dev/natsumi-browser&type=Date" alt="Star History Chart" width="800">
  </a>
</p>



<p align="center">It is so crazy to me that Nebula has become one of the biggest mods for Zen Browser in such a short period of time! really appreciate it</p>

###

<h2 align="left">☄️ Installation:</h2>

###
🎥 **Quick note:** If you want a video tutorial for the installation process then it is there on a youtube video someone made about it: https://www.youtube.com/watch?v=ysXRr6GAsNc&t=9s

### 🧊 Nix Installation

>[!WARNING]
> This installation method is for **Linux/MacOs users Only** using [Nix](https://nixos.org/) and [home-manager](https://github.com/nix-community/home-manager).
>
> If you're using `Windows`, read the normal installation process.

<details>
<summary>‼️ Click here for Nix installation process</summary>


This repo includes a **Nix flake** that provides a `home-manager` module to install **Nebula** for **Zen Browser** declaratively.

To enable the module, add this repo as a flake input, import the module, and enable `zen-nebula`.

📦 Install using your <code>home-manager</code> module (inside <code>nixosConfigurations</code>)

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
  };

  outputs = { nixpkgs, home-manager, ... } @ inputs: {
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
  };
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

## 🚀 Installation Guide (Windows, MacOS, and manual Linux installation)

Follow these steps to install and apply the **Nebula** theme on Zen Browser:

1. 📁 **Create the Chrome Folder**
   If you haven't already, follow the [Zen Live Editing Guide](https://docs.zen-browser.app/guides/live-editing) to create your `chrome` folder.

2. 📦 **Download the Theme**
   - Download the `chrome.zip` file from the [latest release](https://github.com/JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser/releases).
   - Extract it and paste the `Nebula` folder inside your `chrome` directory.

3. 🧩 **Apply the Theme**
   You have two options:

   **Option A** – *Manual Import*
   - Open your `userChrome.css` and add:
     ```css
     @import "Nebula/Nebula.css";
     ```
   - Open (or create) `userContent.css` and add:
     ```css
     @import "Nebula/Nebula-content.css";
     ```

   **Option B** – *Use Provided Files*
   - Use the `userChrome.css` and `userContent.css` files provided in the ZIP and paste them directly into your `chrome` folder.

4. 🔄 **Restart the Browser**
   Reopen Zen to apply the UI changes.

5. ⚙️ **Enable Transparent Tabs**
   - Go to `about:config` in Zen.
   - Search for `browser.tabs.allow_transparent_browser`.
   - If visible, set it to `true`.

6. 🖼️ **Install Wallpapers (Optional)**
   - Download `wallpapers.zip` from the [latest release](https://github.com/JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser/releases/latest).
   - Extract and use them as desired.


###

<h3 align="left">2. Customize Nebula through configs</h3>

###

- Nebula features a `Nebula-config.css` file inside the Nebula folder — it allows users to customize Nebula to their own liking!  
- Want to change/disable certain animations? You can do that as well by reading the clear instructions in the `Nebula-config.css` file.  
- There are lots of inbuilt mods which Nebula has baked in — for example, the `nogaps` mod removes the gap/border from the website window.  
- Here is a list of configs which you can change through `about:config`


<div align="center">
    <img width="800" src="https://github.com/user-attachments/assets/2408e11c-8a5c-4b86-9d7f-f7789badecd1" />
</div>

###

<h3 align="left">3. Install Mica For Everyone (ONLY FOR WINDOWS 11 USERS)</h3>

###

<p align="left">
• To get real backdrop filter transparency (note: that this method provides a better blur effect than the transparent zen extension by sameerasw), go to "https://github.com/MicaForEveryone/MicaForEveryone" and install the app.<br><br>
• Click the "+ Add new Rule" at the bottom left and "Add process rule" for "zen".<br><br>
• NOTE: If you have "Show Accent color on title bars and window borders" enabled in Windows 11 settings, please disable it for transparency to work.
</p>
<img width="900" src="https://github.com/user-attachments/assets/e867a04e-a8ba-4795-bada-e22ca92fc657" />
<br><br>
<p align="left">
• Also, please make sure your Zen theme color contrast is set to 0 for it to look transparent.
</p>
<img width="250" src="https://github.com/user-attachments/assets/aff8398c-9457-4842-bb44-32932cb99e23" />

###

<div align="left">
  <img height="400" src="https://github.com/user-attachments/assets/34f6965c-1bdc-4ea1-8605-efde3b898d23"  />
</div>

###

<p align="left">• Change the Backdrop type to Acrylic and enable blur behind in advanced options.<br><br>• Restart Zen and see how it looks.</p>

###
<h3 align="left">3. Install kwin-effects-forceblur (ONLY FOR KDE LINUX)</h3>

###
<p align="left">• To get real backdrop filter transparency, go to "https://github.com/taj-ny/kwin-effects-forceblur" and install the app.<br><br>• It's required to install 'kwin-effects-forceblur' from AUR then go to System Settings -> Windows -> Desktop Effecs, disable Blur and enable Better Blur and in Better Blur settings go to 'Force blur' tab and add 'zen' to list of classes of windows.<br><br>• NOTE: If Zen was installed from AUR as "zen-browser-bin", then in KDE put the name "zen-browser" for blur Here is the blur configuration: </p>

###

<div align="center">
  <img height="300" src="https://github.com/user-attachments/assets/8a19fcdd-acf9-4540-9833-ae0be3cce363"  />
</div>

###

<h3 align="left">4. Add the Firefox extension Bonjourrr</h3>

###

<p align="left">• Go to "https://addons.mozilla.org/en-US/firefox/addon/bonjourr-startpage/" and install this extension.<br><br>• The new tab must be replaced by this now. On the bottom right, you will see a settings button for new tab. Change the settings to these:</p>

| ![image](https://github.com/user-attachments/assets/e7e27035-6e2b-4006-abf7-091a103536f9) | ![image](https://github.com/user-attachments/assets/d8fb107f-1247-4a3e-8026-619311e2dee5) | ![image](https://github.com/user-attachments/assets/724abcd8-a9f0-4d76-a054-3d76e3c7db60) |
|-|-|-|

###

<p align="left">• In the section where it says "Add custom CSS", add this code to change font of newtab and make it transparent:</p>

```css
@import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap');

body, h1, h2, h3, h4, h5, h6, p, span, div {
    font-family: 'Comfortaa', sans-serif !important;
    font-weight: 300 !important;
    letter-spacing: 0.015em;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: color 0.3s ease, text-shadow 0.3s ease;
}

/* Light mode */
@media (prefers-color-scheme: light) {
    body, h1, h2, h3, h4, h5, h6, p, span, div {
        color: #222222;
        text-shadow: 0 0 1px rgba(0, 0, 0, 0.15);
    }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    body, h1, h2, h3, h4, h5, h6, p, span, div {
        color: #e0e0e0;
        text-shadow: 0 0 1px rgba(255, 255, 255, 0.2);
    }
}

h1 {
    font-weight: 400 !important;
    letter-spacing: 0.025em;
}

p {
    font-weight: 300 !important;
    line-height: 1.6;
    letter-spacing: 0.015em;
}
#background {
    background-color: transparent !important;
}
#background {background-image: none !important; background-color: transparent !important;}
   .tabbing {background-color: transparent !important;} 
    body {background-color: transparent !important;}
```
###

### 6. Add the extension [Zen Internet by Sameerasw](https://addons.mozilla.org/en-US/firefox/addon/zen-internet/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search) (Optional)

> This extension makes web pages transparent

###

<h2 align="left">Re-distribution info:</h2>

<p align="left">You are totally free to make forks of this or put this in your chrome file and create or modify it according to yourself. It is suggested to credit me if you use my theme. Thanks for using Nebula 🫶🏻</p>


## 🙌 Credits

Here are some awesome projects that inspired or contributed to this project:

- 🔗 [Lacuna by Tanay-Kar](https://github.com/Tanay-Kar/Lacuna)
- 🌐 [Natsumi Browser by greeeen-dev](https://github.com/greeeen-dev/natsumi-browser)
- 🧠 [My Internet by sameerasw](https://github.com/sameerasw/my-internet)
- 🍍 [Pineapple Fried by TheBigWazz](https://github.com/TheBigWazz/Pineapple-Fried)
- 🧩 [Advanced Tab Groups by TFFC-Anoms12](https://github.com/TFFC-Anoms12/Advanced-Tab-Groups)

---
If I missed anyone, kindly let me know! 😊

###

> [!NOTE]
> There might be some issues with this theme, please report them to me if you experience something unusual, i will try to fix/clarify it. Also this mod has only been tested by me on a windows 11 computer so if Linux and MacOS versions are not working properly then i can't really do anything about it :(
