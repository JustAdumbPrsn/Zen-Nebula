{ lib, ... }:
{
  options.zen-nebula = {
    enable = lib.mkEnableOption "Zen-Nebula theme.";
    profile = lib.mkOption {
      type = lib.types.str;
      description = "The profile to apply the textfox configuration to";
    };
  };
}
