@echo OFF
@cls
@pushd %~dp0
@echo Installing the 64bit version of TAP Driver
tapinstall.exe install OemVista.inf tap0901
pause