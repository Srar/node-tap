

#ifndef ERRORS_MSG_H_
#define ERRORS_MSG_H_

#include <nan.h>
#include <string>

#define ErrorCallback(callback, errmsg)                 \
    v8::Local<v8::Value> argv[] = {Nan::Error(errmsg)}; \
    callback->Call(1, argv);                            \
    return;

#endif