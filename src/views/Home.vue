<script setup lang="ts">

import { ref, onMounted, nextTick } from 'vue'
import { message as AMessage } from 'ant-design-vue'
import JMuxer from 'jmuxer'

const { ipcRenderer } = require('electron')

const devices = ref([] as any[])
const getDevices = async () => {
    const res = await ipcRenderer.invoke('devices')
    devices.value = res
    for (const device of devices.value) {
        // remark
        device.remark = localStorage.getItem(`REMARK:${device.host}`)
    }
    nextTick(() => {
        renderAllDisplay()
    })
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
    const jmuxer = new JMuxer({
        node: `player_${device.host}`,
        mode: 'video',
        debug: false,
    });

    const ws = new WebSocket('ws://localhost:9803')
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        ws.send(device.host)
        device.display = true;
    }

    ws.onmessage = ({ data }) => {
        try {
            jmuxer.feed({
                video: new Uint8Array(data),
            });
        } catch (error) {
            console.error(error)
        }
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

</script>
    
<template>
    <div>
        <a-card title="设备">
            <template #extra><a @click="getDevices">刷新</a></template>
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
            <a-card v-for="record in devices" style="width: 20vmax; height: 35vmax; margin: 10px">
                <video :id="`player_${record.host}`" autoplay style="width: 100%"></video>
                <a-form>
                    <a-form-item label="HOST">
                        {{ record.host }}
                    </a-form-item>
                    <a-form-item label="备注">
                        <a-input-group compact>
                            <a-input v-model:value="record.remark" style="width: calc(100% - 100px)"
                                @change="record.remark_modify = true" />
                            <a-button type="primary" @click="setRemark(record)" :disabled="!record.remark_modify">保存
                            </a-button>
                        </a-input-group>
                    </a-form-item>
                    <a-form-item label="控制">
                        <a-button type="primary" size="mini" @click="connect(record)"
                            :disabled="deviceStatus[record.host]">{{
                            deviceStatus[record.host] ? '已连接' : '连接' }}</a-button>
                    </a-form-item>
                </a-form>
            </a-card>
        </div>
    </div>
</template>
    