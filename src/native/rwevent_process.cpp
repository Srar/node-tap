#include <nan.h>
#include <iostream>
#include "./rwevent_process.hpp"

enum RwWorkerOpt
{
    READ,
    WRITE
};

class RwWorker : public Nan::AsyncWorker
{
  private:
    HANDLE handle;
    void *data;
    int dataSize;
    RwWorkerOpt rw;
    OVERLAPPED *event;
    DWORD errorCode;

  public:
    RwWorker(RwWorkerOpt rw, HANDLE handle, OVERLAPPED *event, void *data, int dataSize, Nan::Callback *callback) : AsyncWorker(callback)
    {
        this->handle = handle;
        this->data = data;
        this->dataSize = dataSize;
        this->rw = rw;
        this->event = event;
        this->callback = callback;
        if (this->rw == READ)
            this->data = malloc(dataSize);
    };

    ~RwWorker()
    {
    }

    void static FreeMemory(char *data, void *hint)
    {
        free(hint);
    }

    void Execute()
    {
        if (this->rw == RwWorkerOpt::READ)
        {
            if (ReadFile(this->handle, this->data, this->dataSize, (LPDWORD) & this->dataSize, this->event) || (this->errorCode = GetLastError()) == ERROR_IO_PENDING)
            {
                WaitForSingleObject(this->event->hEvent, INFINITE);
                GetOverlappedResult(this->handle, this->event, (LPDWORD) & this->dataSize, 0);
            }
            return;
        }
        else
        {
            // Write
            if (WriteFile(this->handle, this->data, this->dataSize, NULL, this->event) || (this->errorCode = GetLastError()) == ERROR_IO_PENDING)
            {
                WaitForSingleObject(this->event->hEvent, INFINITE);
                GetOverlappedResult(this->handle, this->event, (LPDWORD) & this->dataSize, 0);
            }
        }
    }

    void HandleOKCallback()
    {
        if (this->rw == RwWorkerOpt::READ)
        {
            v8::Local<v8::Object> bufs = Nan::NewBuffer((char *)this->data, this->dataSize, RwWorker::FreeMemory, this->data).ToLocalChecked();
            v8::Local<v8::Value> argv[] = {
                ((this->errorCode == ERROR_SUCCESS || this->errorCode == ERROR_IO_PENDING) ? Nan::Null() : Nan::New<v8::Number>((int)this->errorCode)),
                bufs};
            callback->Call(2, argv);
        }
        else
        {
            v8::Local<v8::Value> argv[] = {
                ((this->errorCode == ERROR_SUCCESS || this->errorCode == ERROR_IO_PENDING) ? Nan::Null() : Nan::New<v8::Number>((int)this->errorCode))};
            callback->Call(1, argv);
        }
    }
};

Nan::Persistent<v8::Function> RwEventProcess::constructor;

RwEventProcess::RwEventProcess(HANDLE handle) : handle(handle)
{
    memset(&this->readEvent, 0, sizeof this->readEvent);
    this->readEvent.hEvent = CreateEvent(NULL, FALSE, FALSE, NULL);

    memset(&this->writeEvent, 0, sizeof this->writeEvent);
    this->writeEvent.hEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
}

RwEventProcess::~RwEventProcess()
{
    std::cout << "release" << std::endl;
}

void RwEventProcess::Init(v8::Local<v8::Object> exports)
{
    Nan::HandleScope scope;

    // Prepare constructor template
    v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
    tpl->SetClassName(Nan::New("RwEventProcess").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    // Prototype
    Nan::SetPrototypeMethod(tpl, "getHandle", GetHandle);
    Nan::SetPrototypeMethod(tpl, "read", Read);
    Nan::SetPrototypeMethod(tpl, "write", Write);
    Nan::SetPrototypeMethod(tpl, "writeSync", WriteSync);

    constructor.Reset(tpl->GetFunction());
    exports->Set(Nan::New("RwEventProcess").ToLocalChecked(), tpl->GetFunction());
}

void RwEventProcess::New(const Nan::FunctionCallbackInfo<v8::Value> &info)
{
    if (info.IsConstructCall())
    {
        // Invoked as constructor: `new RwEventProcess(...)`
        long handle = info[0]->IsUndefined() ? 0 : (long)info[0]->NumberValue();
        RwEventProcess *obj = new RwEventProcess((HANDLE)handle);
        obj->Wrap(info.This());
        info.GetReturnValue().Set(info.This());
    }
    else
    {
        // Invoked as plain function `RwEventProcess(...)`, turn into construct call.
        const int argc = 1;
        v8::Local<v8::Value> argv[argc] = {info[0]};
        v8::Local<v8::Function> cons = Nan::New<v8::Function>(constructor);
        info.GetReturnValue().Set(cons->NewInstance(argc, argv));
    }
}

void RwEventProcess::GetHandle(const Nan::FunctionCallbackInfo<v8::Value> &info)
{
    RwEventProcess *obj = ObjectWrap::Unwrap<RwEventProcess>(info.Holder());
    info.GetReturnValue().Set(Nan::New((long)obj->handle));
}

void RwEventProcess::Read(const Nan::FunctionCallbackInfo<v8::Value> &info)
{
    if (info.Length() != 1)
    {
        Nan::ThrowError("Wrong number of arguments.");
        return;
    }
    if (!info[0]->IsFunction())
    {
        Nan::ThrowError("Wrong type of arguments.");
        return;
    }
    RwEventProcess *obj = ObjectWrap::Unwrap<RwEventProcess>(info.Holder());
    Nan::Callback *callback = new Nan::Callback(info[0].As<v8::Function>());
    AsyncQueueWorker(new RwWorker(RwWorkerOpt::READ, obj->handle, &obj->readEvent, NULL, 1500, callback));
}

void RwEventProcess::Write(const Nan::FunctionCallbackInfo<v8::Value> &info)
{
    if (info.Length() != 2)
    {
        Nan::ThrowError("Wrong number of arguments.");
        return;
    }

    v8::Local<v8::Object> bufs = v8::Local<v8::Object>::Cast(info[0]);
    size_t bufsSize = node::Buffer::Length(bufs);

    if (!info[1]->IsFunction())
    {
        Nan::ThrowError("Wrong type of arguments.");
        return;
    }
    RwEventProcess *obj = ObjectWrap::Unwrap<RwEventProcess>(info.Holder());
    Nan::Callback *callback = new Nan::Callback(info[1].As<v8::Function>());
    AsyncQueueWorker(new RwWorker(RwWorkerOpt::WRITE, obj->handle, &obj->writeEvent, (char *)node::Buffer::Data(bufs), bufsSize, callback));
}

void RwEventProcess::WriteSync(const Nan::FunctionCallbackInfo<v8::Value> &info)
{
    if (info.Length() != 1)
    {
        Nan::ThrowError("Wrong number of arguments.");
        return;
    }

    v8::Local<v8::Object> bufs = v8::Local<v8::Object>::Cast(info[0]);
    size_t bufsSize = node::Buffer::Length(bufs);
    RwEventProcess *obj = ObjectWrap::Unwrap<RwEventProcess>(info.Holder());
    if (WriteFile(obj->handle, (char *)node::Buffer::Data(bufs),bufsSize, NULL, &obj->writeEvent) ||GetLastError() == ERROR_IO_PENDING) {
        WaitForSingleObject(obj->writeEvent.hEvent, INFINITE);
    }   
}