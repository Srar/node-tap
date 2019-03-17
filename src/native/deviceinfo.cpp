
#include <nan.h>
#include <iphlpapi.h>
#include "./util.hpp"
#include "./error.hpp"
#include "./deviceinfo.hpp"

#pragma comment(lib, "iphlpapi.lib")

using namespace std;

NAN_METHOD(N_GetAllDevicesInfo)
{
    v8::Local<v8::Array> result = Nan::New<v8::Array>();
    int v8ArrayIndex = 0;

    PIP_ADAPTER_INFO pAdapterInfo;
    pAdapterInfo = (IP_ADAPTER_INFO *)malloc(sizeof(IP_ADAPTER_INFO));
    ULONG buflen = sizeof(IP_ADAPTER_INFO);

    if (GetAdaptersInfo(pAdapterInfo, &buflen) == ERROR_BUFFER_OVERFLOW)
    {
        delete pAdapterInfo;
        pAdapterInfo = (IP_ADAPTER_INFO *)malloc(buflen);
    }

    if (GetAdaptersInfo(pAdapterInfo, &buflen) == NO_ERROR)
    {
        PIP_ADAPTER_INFO pAdapter = pAdapterInfo;
        while (pAdapter)
        {
            v8::Local<v8::Object> obj = Nan::New<v8::Object>();
            Nan::Set(obj, Nan::New("name").ToLocalChecked(), Nan::New(pAdapter->AdapterName).ToLocalChecked());
            Nan::Set(obj, Nan::New("description").ToLocalChecked(), Nan::New(pAdapter->Description).ToLocalChecked());
            Nan::Set(obj, Nan::New("type").ToLocalChecked(), Nan::New((int)pAdapter->Type));
            Nan::Set(obj, Nan::New("index").ToLocalChecked(), Nan::New((long)pAdapter->Index));
            Nan::Set(obj, Nan::New("address").ToLocalChecked(), Nan::CopyBuffer((char *)pAdapter->Address, pAdapter->AddressLength).ToLocalChecked());
            Nan::Set(obj, Nan::New("dhcpEnable").ToLocalChecked(), (pAdapter->DhcpEnabled == 0 ? Nan::False() : Nan::True()));
            Nan::Set(obj, Nan::New("currentIpAddress").ToLocalChecked(), Nan::New(pAdapter->IpAddressList.IpAddress.String).ToLocalChecked());
            Nan::Set(obj, Nan::New("gatewayIpAddress").ToLocalChecked(), Nan::New(pAdapter->GatewayList.IpAddress.String).ToLocalChecked());
            Nan::Set(obj, Nan::New("dhcpServer").ToLocalChecked(), Nan::New(pAdapter->DhcpServer.IpAddress.String).ToLocalChecked());
            Nan::Set(obj, Nan::New("primaryWinsServer").ToLocalChecked(), Nan::New(pAdapter->PrimaryWinsServer.IpAddress.String).ToLocalChecked());
            Nan::Set(obj, Nan::New("secondaryWinsServer").ToLocalChecked(), Nan::New(pAdapter->SecondaryWinsServer.IpAddress.String).ToLocalChecked());
            result->Set(v8ArrayIndex++, obj);
            pAdapter = pAdapter->Next;
        }
        info.GetReturnValue().Set(result);
    }
    else
    {
        Nan::ThrowError("Call to GetAdaptersInfo failed.\n");
    }
    if (pAdapterInfo)
    {
        delete pAdapterInfo;
    }
}