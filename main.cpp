#include <nan.h>
#include <string>
#include <cstring>
#include <iostream>
#include <algorithm>

#include <winsock2.h>
#include <windows.h>
#include <ws2def.h>
#include <ws2ipdef.h>
#include <iphlpapi.h>
#include <netioapi.h>

#include <cstdint>

#pragma comment(lib, "Ws2_32.lib")
#pragma comment(lib, "iphlpapi.lib")

using namespace std;

#include "./deviceinfo_worker.hpp"
#include "./devicecontrol_worker.hpp"
#include "./create_ipforward_entry.hpp"
#include "./create_device_file.hpp"
#include "./rwevent_process.hpp"

NAN_METHOD(N_DeviceWrite) {
    if (info.Length() != 2)
    {
        Nan::ThrowError("Wrong number of arguments.");
        return;
    }

    HANDLE handle =(HANDLE)((long)info[0]->NumberValue());
    v8::Local<v8::Object> v8Buffer = v8::Local<v8::Object>::Cast(info[1]);
    size_t dataLength = node::Buffer::Length(v8Buffer);
    uint8_t *data = (uint8_t *)node::Buffer::Data(v8Buffer);

    DWORD dwNumberOfBytesWritten = 0;
	WriteFile(handle, data, dataLength, &dwNumberOfBytesWritten, NULL);
}

NAN_MODULE_INIT(Initialize)
{
    NAN_EXPORT(target, N_GetDeviceInfo);
    NAN_EXPORT(target, N_DeviceControl);
    NAN_EXPORT(target, N_CreateDeviceFile);
    NAN_EXPORT(target, N_DeviceWrite);
    NAN_EXPORT(target, N_CreateIpforwardEntry);
    RwEventProcess::Init(target);
}

NODE_MODULE(addon, Initialize);