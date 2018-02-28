
#include <nan.h>
#include <string>
#include <iostream>
#include "./error.hpp"
#include "./ipforward_entry.hpp"

#include <winsock2.h>
#include <windows.h>
#include <ws2def.h>
#include <ws2ipdef.h>
#include <iphlpapi.h>
#include <netioapi.h>

#pragma comment(lib, "Ws2_32.lib")
#pragma comment(lib, "iphlpapi.lib")

NAN_METHOD(N_CreateIpforwardEntry)
{
    if (info.Length() != 1)
    {
        Nan::ThrowError("Wrong number of arguments.");
        return;
    }

    MIB_IPFORWARDROW ifr;
    ZeroMemory(&ifr, sizeof(MIB_IPFORWARDROW));

    auto obj = v8::Local<v8::Object>::Cast(info[0]);

    if (!(obj->Get(Nan::New<v8::String>("dwForwardDest").ToLocalChecked())->IsUndefined()))
    {
        if (obj->Get(Nan::New<v8::String>("dwForwardDest").ToLocalChecked())->IsNumber())
            ifr.dwForwardDest = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardDest").ToLocalChecked())->NumberValue();
        if (obj->Get(Nan::New<v8::String>("dwForwardDest").ToLocalChecked())->IsString())
        {
            std::string dwForwardDest = *v8::String::Utf8Value(obj->Get(Nan::New<v8::String>("dwForwardDest").ToLocalChecked())->ToString());
            ifr.dwForwardDest = inet_addr(dwForwardDest.c_str());
        }
    }

    if (!(obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsUndefined()))
    {
        if (obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsNumber())
            ifr.dwForwardMask = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->NumberValue();
        if (obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsString())
        {
            std::string dwForwardMask = *v8::String::Utf8Value(obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->ToString());
            ifr.dwForwardMask = inet_addr(dwForwardMask.c_str());
        }
    }

    if (!(obj->Get(Nan::New<v8::String>("dwForwardPolicy").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardPolicy = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardPolicy").ToLocalChecked())->NumberValue();

    if (!(obj->Get(Nan::New<v8::String>("dwForwardNextHop").ToLocalChecked())->IsUndefined()))
    {
        if (obj->Get(Nan::New<v8::String>("dwForwardNextHop").ToLocalChecked())->IsNumber())
            ifr.dwForwardNextHop = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardNextHop").ToLocalChecked())->NumberValue();
        if (obj->Get(Nan::New<v8::String>("dwForwardNextHop").ToLocalChecked())->IsString())
        {
            std::string dwForwardNextHop = *v8::String::Utf8Value(obj->Get(Nan::New<v8::String>("dwForwardNextHop").ToLocalChecked())->ToString());
            ifr.dwForwardNextHop = inet_addr(dwForwardNextHop.c_str());
        }
    }

    if (!(obj->Get(Nan::New<v8::String>("dwForwardIfIndex").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardIfIndex = (long)obj->Get(Nan::New<v8::String>("dwForwardIfIndex").ToLocalChecked())->NumberValue();

    if (!(obj->Get(Nan::New<v8::String>("dwForwardType").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardType = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardType").ToLocalChecked())->NumberValue();

    if (!(obj->Get(Nan::New<v8::String>("dwForwardProto").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardProto = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardProto").ToLocalChecked())->NumberValue();

    if (!(obj->Get(Nan::New<v8::String>("dwForwardAge").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardAge = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardAge").ToLocalChecked())->NumberValue();

    if (!(obj->Get(Nan::New<v8::String>("dwForwardNextHopAS").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardNextHopAS = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardNextHopAS").ToLocalChecked())->NumberValue();

    if (!(obj->Get(Nan::New<v8::String>("dwForwardMetric1").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardMetric1 = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardMetric1").ToLocalChecked())->NumberValue();
    else
        ifr.dwForwardMetric1 = ~0;

    if (!(obj->Get(Nan::New<v8::String>("dwForwardMetric2").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardMetric2 = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardMetric2").ToLocalChecked())->NumberValue();
    else
        ifr.dwForwardMetric2 = ~0;

    if (!(obj->Get(Nan::New<v8::String>("dwForwardMetric3").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardMetric3 = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardMetric3").ToLocalChecked())->NumberValue();
    else
        ifr.dwForwardMetric3 = ~0;

    if (!(obj->Get(Nan::New<v8::String>("dwForwardMetric4").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardMetric4 = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardMetric4").ToLocalChecked())->NumberValue();
    else
        ifr.dwForwardMetric4 = ~0;

    if (!(obj->Get(Nan::New<v8::String>("dwForwardMetric5").ToLocalChecked())->IsUndefined()))
        ifr.dwForwardMetric5 = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardMetric5").ToLocalChecked())->NumberValue();
    else
        ifr.dwForwardMetric5 = ~0;

    DWORD result = CreateIpForwardEntry(&ifr);

    info.GetReturnValue().Set((long)result);
}