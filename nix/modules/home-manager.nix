{
  lib,
  config,
  pkgs,
  ...
}:
let
  cfg = config.zen-nebula;
  package = pkgs.callPackage ./../pkgs/default.nix { };
  configDir = # TODO: Check for path for macOS
    if pkgs.stdenv.hostPlatform.isDarwin then "Library/Application\ Support/zen/Profiles" else ".zen";
in
{

  imports = [ ./options.nix ];

  config = lib.mkIf cfg.enable {
    home.file."zen-nebula" = {
      source = package;
      target = "${configDir}/${cfg.profile}/chrome";
      recursive = true;
    };
  };
}
