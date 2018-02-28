{
    "targets": [
        {
            "include_dirs": [
                "<!(node -e \"require('nan')\")"
            ],
            "cflags_cc": [
               "-O3"
            ],
            "xcode_settings": {
                "CLANG_CXX_LANGUAGE_STANDARD": "c++11",
                "CLANG_CXX_LIBRARY": "libc++",
                "MACOSX_DEPLOYMENT_TARGET": "10.7",
                "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                "GCC_ENABLE_CPP_RTTI": "YES",
                "OTHER_CPLUSPLUSFLAGS": [
                    "-O3"
                ]
            },
            "libraries": [
                
            ],
            "target_name": "addon",
            "sources": [
                "main.cpp",
                "deviceinfo_worker.cpp",
                "devicecontrol_worker.cpp",
                "ipforward_entry.cpp",
                "create_device_file.cpp",
                "rwevent_process.cpp"
            ]
        }
    ]
}