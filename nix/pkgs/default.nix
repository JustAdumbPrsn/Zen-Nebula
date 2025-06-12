{ stdenv, ... }:

stdenv.mkDerivation {
  pname = "nebula-zen-theme";
  version = "git";

  src = ../../.;

  installPhase = ''
    mkdir -p $out/
    cp -r $src/Nebula $out/
    cp -r $src/userChrome.css $out/
    cp -r $src/userContent.css $out/
  '';
}
