@echo off
setlocal

:: Set download URL and file paths
set DOWNLOAD_URL=https://github.com/JustAdumbPrsn/Zen-Nebula/releases/latest/download/chrome.zip
set ZIP_PATH=%TEMP%\nebula_update.zip
set EXTRACT_PATH=%TEMP%\nebula_update
set DEST_PATH=%~dp0
set NEBULA_PATH=%DEST_PATH%\Nebula
set OLD_BACKUP_PREFIX=OLD.Nebula-Backup

:: Check if Nebula folder exists and handle backup
if exist "%NEBULA_PATH%" (
    :: Find the next available OLD.Nebula-Backup number
    set /a COUNTER=1
    :loop
    if exist "%DEST_PATH%\%OLD_BACKUP_PREFIX%%COUNTER%" (
        set /a COUNTER+=1
        goto loop
    )
    ren "%NEBULA_PATH%" "%OLD_BACKUP_PREFIX%%COUNTER%" || (
        echo Error: Failed to rename Nebula folder to %OLD_BACKUP_PREFIX%%COUNTER%
        goto error
    )
)

:: Check for updates
curl -L "%DOWNLOAD_URL%" -o "%ZIP_PATH%" || (
    echo Error: Failed to download update
    goto error
)

:: Extract the update
powershell -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%EXTRACT_PATH%' -Force" || (
    echo Error: Failed to extract update
    goto error
)

:: Update Nebula folder
xcopy "%EXTRACT_PATH%\chrome\Nebula" "%NEBULA_PATH%\" /E /Y /I || (
    echo Error: Failed to copy new Nebula folder
    goto error
)

:: Clean up
rd /s /q "%EXTRACT_PATH%" 2>nul
del "%ZIP_PATH%" 2>nul

:: Show success message
echo Nebula Updated! the previous Nebula folder is named as OLD.Nebula-Backup for  Backup
goto end

:error
echo An error occurred during the update process.
echo Please check the console for details and try again.

:end
pause
exit /b 0
