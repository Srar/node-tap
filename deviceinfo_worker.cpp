
#include <nan.h>
#include <iostream>
#include <iphlpapi.h>
#include "./util.hpp"
#include "./error.hpp"
#include "./deviceinfo_worker.hpp"

#define REG_VAL_SIZE 512
#define DEVICE_LIST L"SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}\\"
#define DEVICE_INSTANCE_LIST L"SYSTEM\\CurrentControlSet\\Control\\Network\\{4D36E972-E325-11CE-BFC1-08002BE10318}\\"

#pragma comment(lib, "iphlpapi.lib")

using namespace std;

class DeviceInfoWorker : public Nan::AsyncWorker
{
  private:
    WCHAR *deviceId;
    WCHAR *deviceName;
    WCHAR *deviceInstanceId;
    Nan::Callback *callback;

  public:
    DeviceInfoWorker(Nan::Callback *callback) : AsyncWorker(callback)
    {
        this->deviceId = NULL;
        this->deviceName = NULL;
        this->deviceInstanceId = NULL;
        this->callback = callback;
    };

    ~DeviceInfoWorker()
    {
        if (this->deviceId != NULL)
            delete this->deviceId;
        if (this->deviceName != NULL)
            delete this->deviceName;
        if (this->deviceInstanceId != NULL)
            delete this->deviceInstanceId;
    }

    bool comparei(wstring stringA, wstring stringB)
    {
        transform(stringA.begin(), stringA.end(), stringA.begin(), toupper);
        transform(stringB.begin(), stringB.end(), stringB.begin(), toupper);
        return (stringA == stringB);
    }

    LONG GetStringRegKey(HKEY hKey, WCHAR *strValueName, WCHAR *strValue, DWORD size)
    {
        return RegQueryValueExW(hKey, (LPCWSTR)strValueName, 0, NULL, (LPBYTE)strValue, &size);
    }

    inline bool isWcharEmpty(WCHAR *str)
    {
        return (str[0] == '\0');
    }

    void GetDeviceInfo(WCHAR *deviceId, DWORD deviceIdSize, WCHAR *deviceInstanceId, DWORD deviceInstanceIdSize)
    {
        for (int i = 0; i <= 1000; i++)
        {
            wstring strid = to_wstring(i);
            int strid_len = strid.length();
            for (int j = 0; j < 4 - strid_len; j++)
            {
                strid = L"0" + strid;
            }
            wstring adapterFullPath = DEVICE_LIST + strid;

            HKEY hKey;
            LONG lRes = RegOpenKeyExW(HKEY_LOCAL_MACHINE, adapterFullPath.c_str(), 0, KEY_READ, &hKey);
            bool bExistsAndSuccess(lRes == ERROR_SUCCESS);
            if (bExistsAndSuccess == false)
                continue;

            if (GetStringRegKey(hKey, L"ComponentId", deviceId, deviceIdSize) != ERROR_SUCCESS)
                continue;
            if ((comparei(deviceId, L"tap0901") || (comparei(deviceId, L"tap0801"))))
            {
                GetStringRegKey(hKey, L"NetCfgInstanceId", deviceInstanceId, deviceInstanceIdSize);
                return;
            }
        }
    }

    LSTATUS GetDeviceName(WCHAR *deviceInstanceId, WCHAR *deviceName, DWORD deviceNameSize)
    {
        wstring fullPath = DEVICE_INSTANCE_LIST + wstring(deviceInstanceId) + L"\\Connection";
        HKEY hKey;
        LONG lRes = RegOpenKeyExW(HKEY_LOCAL_MACHINE, fullPath.c_str(), 0, KEY_READ, &hKey);
        if (lRes != ERROR_SUCCESS)
            return lRes;
        return GetStringRegKey(hKey, L"Name", deviceName, deviceNameSize);
    }

    bool GetDeviceInfo(const char *deviceInstanceId, PIP_ADAPTER_INFO *arg)
    {
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
                if(strcmp(deviceInstanceId, pAdapter->AdapterName) == 0) {
                    memcpy (arg, &pAdapter, sizeof(PIP_ADAPTER_INFO) );
                    return true;
                }
                pAdapter = pAdapter->Next;
            }
        }
        else
        {
            printf("Call to GetAdaptersInfo failed.\n");
        }
        delete pAdapterInfo;
        return false;
    }

    void Execute()
    {
        this->deviceId = new WCHAR[REG_VAL_SIZE];
        this->deviceInstanceId = new WCHAR[REG_VAL_SIZE];
        this->deviceName = new WCHAR[REG_VAL_SIZE];
        this->deviceId[0] = '\0';
        this->deviceInstanceId[0] = '\0';
        this->deviceName[0] = '\0';
        GetDeviceInfo(this->deviceId, REG_VAL_SIZE, this->deviceInstanceId, REG_VAL_SIZE);
        GetDeviceName(this->deviceInstanceId, this->deviceName, REG_VAL_SIZE);
    }

    void HandleOKCallback()
    {
        std::wcout.imbue(std::locale("chs"));

        if (this->isWcharEmpty(this->deviceId) || this->isWcharEmpty(this->deviceInstanceId))
        {
            ErrorCallback(this->callback, "The TAP is not installed.")
        }

        if (this->isWcharEmpty(this->deviceInstanceId))
        {
            ErrorCallback(this->callback, "The instance of Tap is not be found.")
        }

        string deviceId;
        string deviceName;
        string deviceInstanceId;

        deviceId = Utf8Encode(this->deviceId);
        deviceName = Utf8Encode(this->deviceName);
        deviceInstanceId = Utf8Encode(this->deviceInstanceId);

        PIP_ADAPTER_INFO apapterInfo;
    
        if(GetDeviceInfo(deviceInstanceId.c_str(), &apapterInfo) == false) {
            ErrorCallback(this->callback, "The instance info of Tap is not be found.")
        }

        v8::Local<v8::Object> obj = Nan::New<v8::Object>();
        Nan::Set(obj, Nan::New("id").ToLocalChecked(), Nan::New(deviceId.c_str()).ToLocalChecked());
        Nan::Set(obj, Nan::New("name").ToLocalChecked(), Nan::New(deviceName.c_str()).ToLocalChecked());
        Nan::Set(obj, Nan::New("type").ToLocalChecked(), Nan::New((int)apapterInfo->Type));
        Nan::Set(obj, Nan::New("index").ToLocalChecked(), Nan::New((long)apapterInfo->Index));
        Nan::Set(obj, Nan::New("address").ToLocalChecked(), Nan::CopyBuffer((char *)apapterInfo->Address, apapterInfo->AddressLength).ToLocalChecked());
        Nan::Set(obj, Nan::New("dhcpEnable").ToLocalChecked(), (apapterInfo->DhcpEnabled == 0 ? Nan::False() : Nan::True()));
        Nan::Set(obj, Nan::New("instanceId").ToLocalChecked(), Nan::New(deviceInstanceId.c_str()).ToLocalChecked());
        Nan::Set(obj, Nan::New("currentIpAddress").ToLocalChecked(), Nan::New(apapterInfo->IpAddressList.IpAddress.String).ToLocalChecked());
        Nan::Set(obj, Nan::New("gatewayIpAddress").ToLocalChecked(), Nan::New(apapterInfo->GatewayList.IpAddress.String).ToLocalChecked());
        Nan::Set(obj, Nan::New("dhcpServer").ToLocalChecked(), Nan::New(apapterInfo->DhcpServer.IpAddress.String).ToLocalChecked());
        Nan::Set(obj, Nan::New("primaryWinsServer").ToLocalChecked(), Nan::New(apapterInfo->PrimaryWinsServer.IpAddress.String).ToLocalChecked());
        Nan::Set(obj, Nan::New("secondaryWinsServer").ToLocalChecked(), Nan::New(apapterInfo->SecondaryWinsServer.IpAddress.String).ToLocalChecked());
        v8::Local<v8::Value> argv[] = {Nan::Undefined(), obj};
        this->callback->Call(2, argv);
    }
};

NAN_METHOD(N_GetDeviceInfo)
{
    if (info.Length() != 1)
    {
        Nan::ThrowError("Wrong number of arguments");
        return;
    }
    Nan::Callback *callback = new Nan::Callback(info[0].As<v8::Function>());
    AsyncQueueWorker(new DeviceInfoWorker(callback));
}