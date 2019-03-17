#ifndef RWEVENTPROECSS_H
#define RWEVENTPROECSS_H

#include <nan.h>

class RwEventProcess : public Nan::ObjectWrap
{
  public:
    static void Init(v8::Local<v8::Object> exports);

  private:
    explicit RwEventProcess(HANDLE handle);
    ~RwEventProcess();
    static void Read(const Nan::FunctionCallbackInfo<v8::Value> &info);
    static void Write(const Nan::FunctionCallbackInfo<v8::Value> &info);
    static void WriteSync(const Nan::FunctionCallbackInfo<v8::Value> &info);
    static void GetHandle(const Nan::FunctionCallbackInfo<v8::Value> &info);
    static void New(const Nan::FunctionCallbackInfo<v8::Value> &info);
    static Nan::Persistent<v8::Function> constructor;
    HANDLE handle;
    OVERLAPPED readEvent;
    OVERLAPPED writeEvent;
};

#endif