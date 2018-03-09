
#include <nan.h>
#include "./error.hpp"

using namespace std;

class DeviceControlWorker : public Nan::AsyncWorker
{
  private:
    HANDLE handle;
    DWORD ctlcode;
    void *inputData;
    DWORD inputDataLength;
    void *outputData;
    DWORD outputDataLength;
    DWORD outputDataReturned;
    Nan::Callback *callback;
    DWORD errorCode;
  public:
    DeviceControlWorker(HANDLE handle, DWORD ctlcode, void *inputData, DWORD inputDataLength, DWORD outputDataLength, Nan::Callback *callback) : AsyncWorker(callback)
    {
        this->handle = handle;
        this->ctlcode = ctlcode;
        this->inputData = inputData;
        this->inputDataLength = inputDataLength;
        this->outputData = NULL;
        this->outputDataLength = outputDataLength;
        this->callback = callback;
    };
    
    ~DeviceControlWorker()
    {
        if(this->outputData != NULL) free(this->outputData);
    }

    void Execute()
    {
        this->outputData = malloc(this->outputDataLength);
        DeviceIoControl(this->handle, this->ctlcode, this->inputData, this->inputDataLength, this->outputData, this->outputDataLength, &this->outputDataReturned, NULL);
        this->errorCode = GetLastError();
    }

    void HandleOKCallback()
    {
        v8::Local<v8::Value> argv[] = {
            (this->errorCode == ERROR_SUCCESS ? Nan::Null() : Nan::New<v8::Number>((int)this->errorCode)), 
            Nan::CopyBuffer((char *)this->outputData, this->outputDataReturned).ToLocalChecked()
        };
        this->callback->Call(2, argv);
    }
};

NAN_METHOD(N_DeviceControl)
{
    if (info.Length() != 5)
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

    if(!info[3]->IsNumber()) {
        Nan::ThrowError("Wrong type of output length.");
        return;
    }
    DWORD outputDataLength = (DWORD)info[3]->NumberValue();

    if(!info[4]->IsFunction()) {
         Nan::ThrowError("Wrong type of callback.");
        return;
    }
    Nan::Callback *callback = new Nan::Callback(info[4].As<v8::Function>());
    AsyncQueueWorker(new DeviceControlWorker((HANDLE)handle, CTLCode, inputData, inputDataLength, outputDataLength, callback));
}