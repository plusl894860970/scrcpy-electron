<script setup lang="ts">

import { ref } from 'vue'
import { message as AMessage } from 'ant-design-vue'

const { ipcRenderer } = require('electron')

const devices = ref([] as any[])
const getDevices = async () => {
  const res = await ipcRenderer.invoke('devices')
  devices.value = res
  for (const device of devices.value) {
    // remark
    device.remark = localStorage.getItem(`REMARK:${device.host}`)
  }
}

getDevices()

const columns = [
  {
    title: '标识',
    key: 'name',
    dataIndex: 'name',
  },
  {
    title: 'HOST',
    key: 'host',
    dataIndex: 'host',
  },
  {
    title: '备注',
    key: 'remark',
  },
  {
    title: '操作',
    key: 'action',
  }
];

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

ipcRenderer.on('disconnect', (e, data) => {
  console.log('断开连接', data)
  deviceStatus.value[data.host] = false
  AMessage.error(`${data.host} 断开连接`)
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
      <a-table :columns="columns" :dataSource="devices" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a-button type="primary" size="mini" @click="connect(record)" :disabled="deviceStatus[record.host]">{{
            deviceStatus[record.host] ? '已连接' : '连接' }}</a-button>
          </template>
          <template v-else-if="column.key === 'remark'">
            <a-input-group compact>
              <a-input v-model:value="record.remark" style="width: calc(100% - 100px)"
                @change="record.remark_modify = true" />
              <a-button type="primary" @click="setRemark(record)" :disabled="!record.remark_modify">保存</a-button>
            </a-input-group>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
