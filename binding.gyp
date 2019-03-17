{
    "targets": [
        {
            "include_dirs": [
                "<!(node -e \"require('nan')\")"
            ],
            "cflags_cc": [
               "-O2"
            ],
            "libraries": [
                
            ],
            "target_name": "addon",
            "sources": [
                "./src/native/main.cpp",
                "./src/native/deviceinfo.cpp",
                "./src/native/devicecontrol.cpp",
                "./src/native/ipforward_entry.cpp",
                "./src/native/create_device_file.cpp",
                "./src/native/rwevent_process.cpp"
            ]
        }
    ]
}