<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '@/plugins/axios';

// UI variables
const router = useRouter();
const createGroupDialog = ref(false);
const deleteGroupDialog = ref(false);
const patchGroupDialog = ref(false);
const importDialog = ref(false);
const value = ref(0);
const importExample = "Excel匯入範例\r\n王教授	ntugice@ntu.edu.tw\r\nWang Prof	ntugice@ntu.edu.tw";

// variables
const allGroups = ref([]);
const localGroups = ref([]);
const outlookGroups = ref([]);
const importData = ref([]);
const importGroups = ref([]);
const groupList = ref([]);
const siteInfo = ref({});

const newGroup = ref({
  groupName: '',
  descriptiveName: '',
  description: '',
  type: '',
});

const importSteps = ref([
  {
    title: '1.從 Excel 貼上名單',
    disabled: false,
  },
  {
    title: '2.選擇人員群組',
    disabled: true,
  },
  {
    title: '3.完成',
    disabled: true,
  },
])

const headers = [
  { title: '群組名稱', key: 'groupName', sortable: true, width: '16%' },
  { title: '群組中文名稱', key: 'descriptiveName', sortable: false, width: '16%' },
  { title: '群組描述', key: 'description', sortable: false, width: '36%' },
  { title: '群組人數', key: 'length', sortable: true, width: '16%' },
  { title: '動作 (檢視、編輯、刪除)', key: 'actions', sortable: false, width: '16%' },
];

const rules = [
  value => {
    if (value) return true
    return 'Please Fill out This Field.'
  },
]

const emailRule = (v) => {
  return !!(v || '').trim().match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/) || false
}

// functions
const closeCreateGroup = async () => {
  createGroupDialog.value = false;
  await resetNewGroup();
  await refreshPage();
}

const closeImportDialog = async () => {
  importDialog.value = false;
  importData.value = [];
  importGroups.value = [];
  resetImportSteps();
  await refreshPage();
}

const closePatchGroup = async () => {
  patchGroupDialog.value = false;
  await resetNewGroup();
  await refreshPage();
}

const createGroup = async (groupType) => {
  createGroupDialog.value = true;
  if (groupType === 'OUTLOOK') {
    newGroup.value.type = 'OUTLOOK';
  } else {
    newGroup.value.type = 'LOCAL';
  }
}

const deleteGroup = async (group) => {
  deleteGroupDialog.value = true;
  resetNewGroup();
  newGroup.value.groupName = group.groupName;
}

const getGroupList = async (groupType) => {
  console.log("flag", groupType);
  if (groupType === 'OUTLOOK') {
    groupList.value = outlookGroups.value.map(group => group.groupName);
  } else if (groupType === 'LOCAL') {
    groupList.value = localGroups.value.map(group => group.groupName);
  }
}

const getGroups = async () => {
  try {
    const getGroupsResponse = await axios.get('/group');
    allGroups.value = getGroupsResponse.data;
    localGroups.value = allGroups.value.filter(group => group.type === 'LOCAL');
    outlookGroups.value = allGroups.value.filter(group => group.type === 'OUTLOOK');
    getSiteInfo();
  } catch (error) {
    console.error('Error fetching groups:', error);
  }
}

const getSiteInfo = async () => {
  try {
    const getSiteInfoResponse = await axios.get('/site-info');
    if (getSiteInfoResponse?.status == 200) {
      siteInfo.value = getSiteInfoResponse.data;
    }
  } catch (error) {
    console.error('Error fetching site info:', error);
  }
}

const importFromExcel = async (groupType) => {
  resetImportSteps();
  getGroupList(groupType);
  importData.value = [];
  importGroups.value = [];
  importGroups.value.type = groupType;
  importDialog.value = true;
}

const importToGroup = async () => {
  if (importData.value.length === 0) {
    return
  }
  importSteps.value[0].disabled = true;
  importSteps.value[1].disabled = false;
  importSteps.value[2].disabled = true;
}

const patchGroup = async (group) => {
  patchGroupDialog.value = true;
  newGroup.value.newGroupName = group.groupName;
  newGroup.value.groupName = group.groupName;
  newGroup.value.descriptiveName = group.descriptiveName;
  newGroup.value.description = group.description;
  newGroup.value.type = group.type;
}

const refreshPage = async () => {
  await getGroups()
}

const resetImportSteps = () => {
  importSteps.value[0].disabled = false;
  importSteps.value[1].disabled = true;
  importSteps.value[2].disabled = true;
}

const resetNewGroup = () => {
  newGroup.value = {
    groupName: '',
    descriptiveName: '',
    description: '',
    type: '',
  };
}

const saveCreateGroup = async () => {
  if (newGroup.value.type === 'OUTLOOK') {
    newGroup.value.groupName += '@ntu.edu.tw';
  } else {
    newGroup.value.groupName = '@local'
  }
  newGroup.value.name = newGroup.value.groupName;
  delete newGroup.value.groupName;

  try {
    const postGroupResponse = await axios.post('/group', JSON.stringify(newGroup.value), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (postGroupResponse?.status == 201) {
      await closeCreateGroup();
    }
  } catch (error) {
    console.error('Error saving group:', error);
  }
}

const saveDeleteGroup = async () => {
  try {
    const deleteGroupResponse = await axios.delete(`/group/${newGroup.value.groupName}`);

    if (deleteGroupResponse?.status == 200) {
      deleteGroupDialog.value = false;
      await resetNewGroup();
      await refreshPage();
    }
  } catch (error) {
    console.error('Error deleting group:', error);
  }
}

const saveImport = async () => {
  importSteps.value[0].disabled = true;
  importSteps.value[1].disabled = true;
  importSteps.value[2].disabled = false;

  const lines = importData.value.trim().split('\n');
  const convertedData = lines.map(line => {
    const [name, address] = line.split('\t');
    return {
      "address": emailRule(address.trim()) ? address.trim() : address.trim() + '@ntu.edu.tw',
      "name": name.trim()
    };
  });

  // create new groups
  importGroups.value.forEach(async (groupName) => {
    if (!groupList.value.includes(groupName)) {
      try {
        const postGroupResponse = await axios.post('/group', JSON.stringify({
          "name": groupName,
          "descriptiveName": groupName,
          "description": groupName,
          "type": importGroups.value.type,
        }), {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (postGroupResponse?.status == 201) {
          console.log('Group created:', groupName);
        }
      } catch (error) {
        console.error('Error creating group:', error);
      }
    }
  });

  // save person to groups
  importGroups.value.map(async (groupName) => {
    try {
      const postPersonToGroupResponse = await axios.put(`/group/${groupName}/person`, JSON.stringify(convertedData), {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (postPersonToGroupResponse?.status == 200) {
        console.log('Person group saved:', groupName);
      }
    } catch (error) {
      console.error('Error saving person group:', error);
    }
  });
  refreshPage();
}

const savePatchGroup = async () => {
  const fd = {
    "description": newGroup.value.description,
    "descriptiveName": newGroup.value.descriptiveName,
  }

  if (newGroup.value.type === 'LOCAL') {
    fd['name'] = newGroup.value.newGroupName;
  }

  try {
    const patchGroupResponse = await axios.patch(`/group/${newGroup.value.groupName}`, JSON.stringify(fd), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (patchGroupResponse?.status == 200) {
      await closePatchGroup();
    }
  } catch (error) {
    console.error('Error saving group:', error);
  }
}

const viewGroup = async (item) => {
  router.push({ path: '/group/' + item.type, query: { name: item.groupName } });
}

// main
refreshPage();

let interval = -1
onMounted(() => {
  interval = setInterval(() => {
    if (value.value === 100) {
      return (value.value = 0)
    }
    value.value += 5
  }, 1000)
})
onBeforeUnmount(() => {
  clearInterval(interval)
})

watch(() => patchGroupDialog.value, (newValue) => {
  if (!newValue) {
    resetNewGroup();
  }
});

</script>

<template>
  <v-container fluid>

    <!-- table: outlook -->
    <v-data-table :headers="headers" :items="outlookGroups">
      <template v-slot:top>
        <v-toolbar flat>
          <v-toolbar-title style="flex-shrink: 0; flex-basis: auto;">&nbsp;Outlook 信件群組&nbsp;
            <v-chip prepend-icon="mdi-account-group-outline" variant="outlined">
              總群組數 x {{ outlookGroups.length }}
            </v-chip>
            &nbsp;
            <v-chip class="text-size-12" color="primary" outlined>
              更新時間: {{ new Date(siteInfo.timestamp).toLocaleString('zh-TW', {
                timeZone: 'Asia/Taipei',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }) }}
            </v-chip>
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn class="mb-2" color="primary" variant="tonal" dark @click="importFromExcel('OUTLOOK')">
            匯入 Excel 教授名單
          </v-btn>
          &nbsp;&nbsp;
          <v-btn class="mb-2" color="primary" variant="outlined" dark @click="createGroup('OUTLOOK')">
            新增群組
          </v-btn>
        </v-toolbar>
      </template>
      <template v-slot:item.actions="{ item }">
        <v-icon class="me-2" size="small" @click="viewGroup(item)">
          mdi mdi-eye
        </v-icon>
        <v-icon class="me-2" size="small" @click="patchGroup(item)">
          mdi mdi-pencil-plus
        </v-icon>
        <v-icon class="me-2" size="small" @click="deleteGroup(item)">
          mdi mdi-trash-can-outline
        </v-icon>
      </template>
    </v-data-table>

    <v-divider :thickness="2" color="gray" class="my-8"></v-divider>

    <!-- table: local -->
    <v-data-table :headers="headers" :items="localGroups">
      <template v-slot:top>
        <v-toolbar flat>
          <v-toolbar-title style="flex-shrink: 0; flex-basis: auto;">&nbsp;Local 信件群組&nbsp;
            <v-chip prepend-icon="mdi-account-group-outline" variant="outlined">
              總群組數 x {{ localGroups.length }}
            </v-chip>
            &nbsp;
            <v-chip class="text-size-12" color="primary" outlined>
              更新時間: {{ new Date(siteInfo.timestamp).toLocaleString('zh-TW', {
                timeZone: 'Asia/Taipei',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }) }}
            </v-chip>
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn class="mb-2" color="primary" variant="tonal" dark @click="importFromExcel('LOCAL')">
            匯入 Excel 學生名單
          </v-btn>
          &nbsp;&nbsp;
          <v-btn class="mb-2" color="primary" variant="outlined" dark @click="createGroup('LOCAL')">
            新增群組
          </v-btn>
        </v-toolbar>
      </template>
      <template v-slot:item.actions="{ item }">
        <v-icon class="me-2" size="small" @click="viewGroup(item)">
          mdi mdi-eye
        </v-icon>
        <v-icon class="me-2" size="small" @click="patchGroup(item)">
          mdi mdi-pencil-plus
        </v-icon>
        <v-icon class="me-2" size="small" @click="deleteGroup(item)">
          mdi mdi-trash-can-outline
        </v-icon>
      </template>
    </v-data-table>

    <!-- dialogs -->
    <v-dialog v-model="createGroupDialog" width="auto" height="auto">
      <v-card min-width="600" max-width="100%" height="100%" prepend-icon="mdi mdi-folder-plus"
        :title="newGroup.type == 'OUTLOOK' ? '新增 Outlook 上的信件群組' : '新增 LOCAL 上的信件群組'">
        <v-card-item>
          <v-row dense style="align-items:center;">
            <v-col cols="3">群組類型：</v-col>
            <v-col cols="9"> {{ newGroup.type }} 信件群組</v-col>
          </v-row>
          <v-row dense style="align-items:center;">
            <v-col cols="3">群組名稱：</v-col>
            <v-col cols="9"><v-text-field v-model="newGroup.groupName" :rules="rules"
                :placeholder="newGroup.type == 'OUTLOOK' ? 'e.g. ntugice-ms' : 'e.g. ntugice-mis'"
                :suffix="newGroup.type == 'OUTLOOK' ? '@ntu.edu.tw' : '@local'"
                variant="outlined"></v-text-field></v-col>
          </v-row>
          <v-row dense style="align-items:center;">
            <v-col cols="3">群組中文名稱：</v-col>
            <v-col cols="9"> <v-text-field v-model="newGroup.descriptiveName" :rules="rules"
                label="Group Name in Chinese" variant="outlined"></v-text-field> </v-col>
          </v-row>
          <v-row dense style="align-items:center;">
            <v-col cols="3">群組描述：</v-col>
            <v-col cols="9"> <v-textarea v-model="newGroup.description" :rules="rules" clearable
                label="Group Description" variant="outlined"></v-textarea> </v-col>
          </v-row>
        </v-card-item>
        <template v-slot:actions>
          <v-spacer></v-spacer>
          <v-btn variant="outlined" @click="closeCreateGroup()">
            取消
          </v-btn>
          <v-btn variant="outlined" @click="saveCreateGroup()">
            儲存群組
          </v-btn>
        </template>
      </v-card>
    </v-dialog>

    <v-dialog v-model="patchGroupDialog" width="auto" height="auto">
      <v-card min-width="600" max-width="100%" height="100%" prepend-icon="mdi mdi-folder-plus"
        :title="newGroup.type == 'OUTLOOK' ? '編輯 Outlook 上的信件群組' : '編輯 LOCAL 上的信件群組'">
        <v-card-item>
          <v-row dense style="align-items:center;">
            <v-col cols="3">群組類型：</v-col>
            <v-col cols="9"> {{ newGroup.type }} 信件群組</v-col>
          </v-row>
          <v-row dense style="align-items:center;">
            <v-col cols="3">群組名稱：</v-col>
            <v-col cols="9"><v-text-field v-model="newGroup.newGroupName" :readonly="newGroup.type == 'OUTLOOK'"
                :rules="rules" :variant="newGroup.type == 'OUTLOOK' ? 'underlined' : 'outlined'"
                placeholder="newGroup.type"></v-text-field></v-col>
          </v-row>
          <v-row dense style="align-items:center;">
            <v-col cols="3">群組中文名稱：</v-col>
            <v-col cols="9"> <v-text-field v-model="newGroup.descriptiveName" :rules="rules"
                label="Group Name in Chinese" variant="outlined"></v-text-field> </v-col>
          </v-row>
          <v-row dense style="align-items:center;">
            <v-col cols="3">群組描述：</v-col>
            <v-col cols="9"> <v-textarea v-model="newGroup.description" :rules="rules" clearable
                label="Group Description" variant="outlined"></v-textarea> </v-col>
          </v-row>
        </v-card-item>
        <template v-slot:actions>
          <v-spacer></v-spacer>
          <v-btn variant="outlined" @click="closePatchGroup()">
            取消
          </v-btn>
          <v-btn variant="outlined" @click="savePatchGroup()">
            儲存群組
          </v-btn>
        </template>
      </v-card>
    </v-dialog>

    <v-dialog v-model="importDialog" width="auto" height="auto">
      <v-card min-width="600" max-width="100%" height="100%" prepend-icon="mdi mdi-folder-plus" title="匯入人員資料">
        <v-card-item>
          <v-breadcrumbs :items="importSteps">
            <template v-slot:divider>
              <v-icon icon="mdi-chevron-right"></v-icon>
            </template>
          </v-breadcrumbs>
          <v-textarea v-if="!importSteps[0].disabled" clearable label="人員名單" :placeholder="importExample" :rules="rules"
            variant="outlined" v-model="importData"></v-textarea>
          <v-card-text v-if="!importSteps[1].disabled">請選擇匯入既有群組或是填寫新群組名稱</v-card-text>
          <v-combobox v-if="!importSteps[1].disabled" v-model="importGroups" :items="groupList" clearable chips
            closable-chips label="Groups" multiple prepend-icon="mdi mdi-account-multiple-plus"
            variant="underlined"></v-combobox>
          <p style="color: red;">注意：選擇的群組將會被匯入人員資料全部刪除取代</p>
          <v-alert v-if="!importSteps[2].disabled" type="success" variant="outlined">
            已匯入人員資料至群組
          </v-alert>
        </v-card-item>
        <template v-slot:actions>
          <v-spacer></v-spacer>
          <v-btn v-if="!importSteps[0].disabled" variant="outlined" @click="closeImportDialog()">
            取消
          </v-btn>
          <v-btn v-if="!importSteps[0].disabled" variant="outlined" @click="importToGroup()">
            下一步
          </v-btn>
          <v-btn v-if="!importSteps[1].disabled" variant="outlined" @click="importFromExcel()">
            上一步
          </v-btn>
          <v-btn v-if="!importSteps[1].disabled" variant="outlined" @click="saveImport()">
            下一步
          </v-btn>
          <v-btn v-if="!importSteps[2].disabled" variant="outlined" @click="closeImportDialog()">
            完成
          </v-btn>
        </template>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteGroupDialog" width="auto">
      <v-sheet class="pa-4 text-center mx-auto" elevation="12" min-width="400" max-width="800" rounded="lg"
        width="100%">
        <!-- <v-icon class="mb-5" color="warning" icon="mdi-check-circle" size="112"></v-icon> -->
        <img src="../../assets/trash.png" alt="Image" style="width: 400px;">

        <h2 class="text-h5 mb-6">是否刪除 {{ newGroup.groupName }} 群組</h2>

        <p class="mb-4 text-medium-emphasis text-body-2">
          如果你不想刪除這個群組，請按取消。<br>
          Otherwise, you're done!
        </p>

        <v-divider class="mb-4"></v-divider>

        <div class="text-end">
          <v-btn class="text-none" color="success" variant="flat" width="90" rounded @click="saveDeleteGroup()">
            確定刪除
          </v-btn>
        </div>
      </v-sheet>
    </v-dialog>

  </v-container>
</template>

<style scoped>
.v-progress-circular {
  margin: 1rem;
}
</style>