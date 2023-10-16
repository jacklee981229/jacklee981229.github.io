---
title: Flutter Get Started
author: Jack Lee
tags:
  - flutter
categories: []
id: 11
date: 2023-10-16 11:46:00
---
Here is some Flutter installation steps, as I feel that some part still missing in the [official flutter documentation](https://docs.flutter.dev/get-started/install/windows).

# Flutter Installation Steps

1. Get the Flutter SDK

    this steps is simple, download, placed somewhere. [link here](https://docs.flutter.dev/get-started/install/windows#get-the-flutter-sdk)
    ![flutter sdk](/images/flutter_get_the_sdk.png)

2. Update your path [link here](https://docs.flutter.dev/get-started/install/windows#update-your-path)

3. Run `flutter` to make sure if path is recognized in cmd

4. Download and install Android Studio Giraffe

    [Android Studio Giraffe](https://developer.android.com/studio)
    
    After installation, create a new project and 'Run'. It will auto download and install neccessary components. An android emulator will be launch in the end.

5. Run `flutter doctor` to check if Android Studio is there.

   ![flutter doctor](/images/flutter_doctor_android_studio.png)
   
   If Flutter cannot locate it, run `flutter config --android-studio-dir=<directory>` to set the directory that Android Studio is installed to.

6. Install command-line tool

   The easiest way is to follow [instruction](https://stackoverflow.com/a/60529140) here:
   
   1. Open Android Studio
   2. Tools Menu, SDK Manager
   3. choose **SDK Tools** from inner panels   
    ![sdk tool](/images/android_studio_sdk_tools_panel.png)
   4. Tick **Android SDK Command-line Tools** and click 'apply'
   
7. Run `flutter doctor --android-licenses` and it should works

8. Run `flutter doctor` to see if any component missing

9. Open up your VS Code editor and install Flutter extension
	
	![vs code extension](/images/flutter_vs_extension.png)
    
	> you may have to restart VS Code after installation
    
10. Run `flutter create {your_app_name}` to create your first project and opened it

11. You shall see a Windows (windows-x64) tab at bottom right, click it

	![devices](/images/vscode_bottom_left_devices.png)

12. A dialog will be prompt, you should see emulators, run it

	![vs code popup devices](/images/vscode_popup_device.png)
    
13. After the emulator is ready, pressed 'F5' and your app shall build on the emulator. ***Whoorays!***


![flutter first app](/images/flutter_first_app_showcase.png)