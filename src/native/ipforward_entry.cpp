
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

NAN_METHOD(N_GetIpforwardEntry)
{
    v8::Local<v8::Array> result = Nan::New<v8::Array>();

    PMIB_IPFORWARDTABLE pIpForwardTable;
    DWORD dwSize = 0;
    DWORD dwRetVal = 0;

    char szDestIp[128];
    char szMaskIp[128];
    char szGatewayIp[128];

    struct in_addr IpAddr;

    pIpForwardTable = (MIB_IPFORWARDTABLE *)HeapAlloc(GetProcessHeap(), 0, sizeof(MIB_IPFORWARDTABLE));
    if (pIpForwardTable == NULL)
    {
        Nan::ThrowError("Error allocating memory.");
        return;
    }

    if (GetIpForwardTable(pIpForwardTable, &dwSize, 0) == ERROR_INSUFFICIENT_BUFFER)
    {
        HeapFree(GetProcessHeap(), 0, pIpForwardTable);
        pIpForwardTable = (MIB_IPFORWARDTABLE *)HeapAlloc(GetProcessHeap(), 0, dwSize);
        if (pIpForwardTable == NULL)
        {
            Nan::ThrowError("Error allocating memory.");
            return;
        }
    }

    /* Note that the IPv4 addresses returned in
	* GetIpForwardTable entries are in network byte order
	*/
    if ((dwRetVal = GetIpForwardTable(pIpForwardTable, &dwSize, 0)) != NO_ERROR)
    {
        HeapFree(GetProcessHeap(), 0, pIpForwardTable);
        Nan::ThrowError("GetIpforwardEntry faild.");
        return;
    }

    for (int i = 0; i < (int)pIpForwardTable->dwNumEntries; i++)
    {
        v8::Local<v8::Object> obj = Nan::New<v8::Object>();

        /* Convert IPv4 addresses to strings */
        IpAddr.S_un.S_addr = (u_long)pIpForwardTable->table[i].dwForwardDest;
        inet_ntop(AF_INET, &(IpAddr), szDestIp, sizeof(szDestIp));

        IpAddr.S_un.S_addr = (u_long)pIpForwardTable->table[i].dwForwardMask;
        inet_ntop(AF_INET, &(IpAddr), szMaskIp, sizeof(szMaskIp));

        IpAddr.S_un.S_addr = (u_long)pIpForwardTable->table[i].dwForwardNextHop;
        inet_ntop(AF_INET, &(IpAddr), szGatewayIp, sizeof(szGatewayIp));

        Nan::Set(obj, Nan::New("destIp").ToLocalChecked(), Nan::New(szDestIp).ToLocalChecked());
        Nan::Set(obj, Nan::New("netMask").ToLocalChecked(), Nan::New(szMaskIp).ToLocalChecked());
        Nan::Set(obj, Nan::New("nextHop").ToLocalChecked(), Nan::New(szGatewayIp).ToLocalChecked());
        Nan::Set(obj, Nan::New("interfaceIndex").ToLocalChecked(), Nan::New((int)pIpForwardTable->table[i].dwForwardIfIndex));
        Nan::Set(obj, Nan::New("type").ToLocalChecked(), Nan::New((int)pIpForwardTable->table[i].dwForwardType));
        Nan::Set(obj, Nan::New("proto").ToLocalChecked(), Nan::New((int)pIpForwardTable->table[i].dwForwardProto));
        Nan::Set(obj, Nan::New("age").ToLocalChecked(), Nan::New((int)pIpForwardTable->table[i].dwForwardAge));
        Nan::Set(obj, Nan::New("metric1").ToLocalChecked(), Nan::New((int)pIpForwardTable->table[i].dwForwardMetric1));

        result->Set(i, obj);
    }
    HeapFree(GetProcessHeap(), 0, pIpForwardTable);
    info.GetReturnValue().Set(result);
}

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
            inet_pton(AF_INET, dwForwardDest.c_str(), &(ifr.dwForwardDest));
        }
    }

    if (!(obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsUndefined()))
    {
        if (obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsNumber())
            ifr.dwForwardMask = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->NumberValue();
        if (obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsString())
        {
            std::string dwForwardMask = *v8::String::Utf8Value(obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->ToString());
            inet_pton(AF_INET, dwForwardMask.c_str(), &(ifr.dwForwardMask));
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
            inet_pton(AF_INET, dwForwardNextHop.c_str(), &(ifr.dwForwardNextHop));
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

NAN_METHOD(N_DeleteIpforwardEntry)
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
            inet_pton(AF_INET, dwForwardDest.c_str(), &(ifr.dwForwardDest));
        }
    }

    if (!(obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsUndefined()))
    {
        if (obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsNumber())
            ifr.dwForwardMask = (DWORD)obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->NumberValue();
        if (obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->IsString())
        {
            std::string dwForwardMask = *v8::String::Utf8Value(obj->Get(Nan::New<v8::String>("dwForwardMask").ToLocalChecked())->ToString());
            inet_pton(AF_INET, dwForwardMask.c_str(), &(ifr.dwForwardMask));
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
            inet_pton(AF_INET, dwForwardNextHop.c_str(), &(ifr.dwForwardNextHop));
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

    DWORD result = DeleteIpForwardEntry(&ifr);

    info.GetReturnValue().Set((long)result);
}