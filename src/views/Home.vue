<script setup lang="ts">

import { ref, onMounted, nextTick, reactive, watch } from 'vue'
import { message as AMessage } from 'ant-design-vue'
import JMuxer from 'jmuxer'

const { ipcRenderer } = require('electron')

const state = reactive({
    plainOptions: [] as any,
    indeterminate: true,
    checkAll: false,
    checkedList: [],
});

const devices = ref([] as any[])
const getDevices = async () => {
    const res = await ipcRenderer.invoke('devices')
    devices.value = res
    state.plainOptions = devices.value.map(o => o.host)
    for (const device of devices.value) {
        // remark
        device.remark = localStorage.getItem(`REMARK:${device.host}`)
        if (device.ws) device.ws.close()
    }
    nextTick(() => {
        renderAllDisplay()
    });
}

const deviceStatus = ref({} as any)

const connect = async (record: any) => {
    const res = await ipcRenderer.invoke('scrcpy', { host: record.host, title: record.remark })
    const { success, message } = res;
    console.log(success, message)
    AMessage[success ? 'success' : 'error'](message)
    if (success) {
        deviceStatus.value[record.host] = true
    }
}

const setRemark = (record: any) => {
    localStorage.setItem(`REMARK:${record.host}`, record.remark)
    AMessage.success('设置成功')
    record.remark_modify = false
}

ipcRenderer.on('disconnect', (e: any, data: any) => {
    console.log('断开连接', data)
    deviceStatus.value[data.host] = false
    AMessage.error(`${data.host} 断开连接`)
})

const renderDisplay = (device: any) => {
    device.signal_connecting = true
    device.video = document.getElementById(`player_${device.host}`)
    device.jmuxer = new JMuxer({
        node: device.video,
        mode: 'video',
        debug: false,
    });

    const ws = new WebSocket('ws://localhost:9803')
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        ws.send(device.host)
        device.display = true;
        device.ws = ws;
        setTimeout(() => {
            device.signal_connecting = false
        }, 3000);
    }

    ws.onmessage = ({ data }) => {
        try {
            device.jmuxer.feed({
                video: new Uint8Array(data),
            });
        } catch (error) {
            console.error(error)
        }
    }

    ws.onclose = () => {
        device.jmuxer.destroy()
        device.jmuxer = null
        device.video.src = ''
        device.display = false
        device.signal_connecting = false
    }
}

const renderAllDisplay = () => {
    for (const device of devices.value) {
        if (device.display) continue
        renderDisplay(device)
    }
}

onMounted(async () => {
    await getDevices()
})

const address = ref('192.168.31.227')
const wirelessConnect = async () => {
    console.log(address.value)
    const { message } = await ipcRenderer.invoke('adb-connect', { host: address.value })
    AMessage.info(message)
    getDevices()
}

const switchDisplay = (record: any) => {
    if (record.ws) record.ws.close()
    if (!record.display) {
        // 开启
        renderDisplay(record)
    }
}

const isShowSelect = ref(false)

const onCheckAllChange = (e: any) => {
    Object.assign(state, {
        checkedList: e.target.checked ? devices.value.map(o => o.host) : [],
        indeterminate: false,
    });
};

watch(
    () => state.checkedList,
    val => {
        state.indeterminate = !!val.length && val.length < state.plainOptions.length;
        state.checkAll = val.length === state.plainOptions.length;
    },
);

const successCount = ref(0)
const installLoading = ref(false)
const confirmInstall = async () => {
    successCount.value = 0
    installLoading.value = true;
    setTimeout(() => {
        if (installLoading.value) installLoading.value = false;
    }, 2 * 60 * 1000)
    const res = await ipcRenderer.invoke('adb-install', { apk: apk.value, hosts: JSON.parse(JSON.stringify(state.checkedList)) })
}

const fileList = ref([] as any)
const apk = ref('')
const handleChange = (e: any) => {
    if (fileList.value.length > 1) fileList.value = fileList.value.slice(1)
    apk.value = e.file.path
}

const installMsg = ref([] as any)
ipcRenderer.on('install-msg', (e: any, data: any) => {
    console.log(data.msg)
    if (data.msg.includes('Success')) successCount.value++
    if (successCount.value >= state.plainOptions.length) {
        installLoading.value = false
        fileList.value = []
    }
    installMsg.value.push(data);
})

</script>
    
<template>
    <div>
        <a-card title="设备">
            <template #extra><a @click="getDevices">刷新</a></template>
            <a-row>
                <a-col :span="5">
                    <a-input-group compact style="margin-bottom: 15px">
                        <a-input v-model:value="address" style="width: calc(100% - 100px)" />
                        <a-button type="primary" @click="wirelessConnect">ADB连接
                        </a-button>
                    </a-input-group>
                </a-col>
                <a-col :span="19">
                    <a-button type="primary" @click="isShowSelect = true">批量安装APK
                    </a-button>
                </a-col>
            </a-row>
            <a-alert show-icon message="操作说明" type="info" style="margin-bottom: 15px">
                <template #description>
                    <div>
                        点击返回键 <a-tag>Alt + B</a-tag>,
                        点击Home键 <a-tag>Alt + H</a-tag>
                    </div>
                </template>
            </a-alert>
        </a-card>
        <div style="display: grid; grid-template-columns: 22.5vw 22.5vw 22.5vw 22.5vw">
            <a-card v-for="record in devices" style="width: 20vmax; margin: 10px">
                <video :id="`player_${record.host}`" autoplay style="width: 100%"></video>
                <a-empty v-if="record.signal_connecting" description="信号连接中"></a-empty>
                <a-empty v-if="!record.display" description="信号断开"></a-empty>
                <div style="margin: 15px auto; text-align: center">{{ record.host }}</div>
                <a-form>
                    <a-form-item label="备注">
                        <a-input-group compact>
                            <a-input v-model:value="record.remark" style="width: calc(100% - 100px)"
                                @change="record.remark_modify = true" />
                            <a-button type="primary" @click="setRemark(record)" :disabled="!record.remark_modify">保存
                            </a-button>
                        </a-input-group>
                    </a-form-item>
                    <a-form-item label="预览">
                        <a-button size="mini" @click="switchDisplay(record)">{{
                        record.display ? '断开' : '连接' }}</a-button>
                    </a-form-item>
                    <a-form-item label="控制">
                        <a-button type="primary" size="mini" @click="connect(record)"
                            :disabled="deviceStatus[record.host]">{{
                            deviceStatus[record.host] ? '已连接' : '连接' }}</a-button>
                    </a-form-item>
                </a-form>
            </a-card>
        </div>
        <a-modal v-model:visible="isShowSelect" title="设备列表" :footer="false">
            <div>
                <a-upload-dragger accept=".apk" v-model:fileList="fileList" name="file" action="#"
                    :customRequest="handleChange">
                    <p class="ant-upload-text">点击或者拖拽文件到此处</p>
                    <p class="ant-upload-hint">
                        仅支持APK文件
                    </p>
                </a-upload-dragger>
            </div>
            <a-divider />
            <div>
                <a-checkbox v-model:checked="state.checkAll" :indeterminate="state.indeterminate"
                    @change="onCheckAllChange">
                    全部
                </a-checkbox>
            </div>
            <a-divider />
            <a-checkbox-group v-model:value="state.checkedList" :options="state.plainOptions" />
            <div style="margin-top: 35px">
                <a-button type="primary" @click="confirmInstall" :loading="installLoading"
                    :disabled="!state.checkedList.length || !apk">安装</a-button>
            </div>
            <a-divider />
            <div v-for="item in installMsg">{{ item.host }}: {{ item.msg }}</div>
        </a-modal>
    </div>
</template>
    