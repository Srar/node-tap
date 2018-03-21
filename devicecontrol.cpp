
#include <nan.h>
#include "./error.hpp"

using namespace std;

NAN_METHOD(N_DeviceControl)
{
    if (info.Length() != 4)
    {
        Nan::ThrowError("Wrong number of arguments.");
        return;
    }

    if (!info[0]->IsNumber())
    {
        Nan::ThrowError("Wrong type of handle.");
        return;
    }
    long handle = (long)info[0]->NumberValue();

    if (!info[1]->IsNumber())
    {
        Nan::ThrowError("Wrong type of CTLCode.");
        return;
    }
    DWORD CTLCode = (DWORD)info[1]->NumberValue();

    v8::Local<v8::Object> inputJsBuffer = v8::Local<v8::Object>::Cast(info[2]);
    void *inputData = (void *)node::Buffer::Data(inputJsBuffer);
    DWORD inputDataLength = node::Buffer::Length(inputJsBuffer);

    if (!info[3]->IsNumber())
    {
        Nan::ThrowError("Wrong type of output length.");
        return;
    }
    DWORD outputDataLength = (DWORD)info[3]->NumberValue();
    void *outputData = malloc(outputDataLength);
    DWORD outputDataReturned;

    DeviceIoControl((HANDLE)handle, CTLCode, inputData, inputDataLength, outputData, outputDataLength, &outputDataReturned, NULL);
    DWORD errorCode = GetLastError();

    if (errorCode != ERROR_SUCCESS)
    {
        Nan::ThrowError("DeviceIoControl Failed: " + errorCode);
        return;
    }
    info.GetReturnValue().Set(Nan::CopyBuffer((char *)outputData, outputDataReturned).ToLocalChecked());
    free(outputData);
}