#include <nan.h>
#include <string>
#include <cstring>

#include "./util.hpp"

NAN_METHOD(N_CreateDeviceFile)
{
    if (info.Length() != 1)
    {
        Nan::ThrowError("Wrong number of arguments.");
        return;
    }

    if (!info[0]->IsString())
    {
        Nan::ThrowError("Wrong type of instanceId.");
        return;
    }

    std::string instanceId = *v8::String::Utf8Value(info[0]->ToString());
    std::string devicePath = "\\\\.\\Global\\" + instanceId + ".tap";
    HANDLE handle = CreateFileW(Utf8Decode(devicePath).c_str(), GENERIC_READ | GENERIC_WRITE, 0, 0, OPEN_EXISTING, FILE_ATTRIBUTE_SYSTEM | FILE_FLAG_OVERLAPPED, 0);
    if (handle == INVALID_HANDLE_VALUE)
    {
        Nan::ThrowError("Invalid handle value.");
        return;
    }
    info.GetReturnValue().Set((long)handle);
}

