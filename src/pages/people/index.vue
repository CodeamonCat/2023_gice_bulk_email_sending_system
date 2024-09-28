<script setup>
import { ref, watch } from 'vue';
import axios from '@/plugins/axios';

// UI variables
const search = ref('');
const deletePersonDialog = ref(false);
const patchPersonDialog = ref(false);

// variables
const person = ref([]);
const groupList = ref([]);

const personUser = ref({
    name: '',
    newName: '',
    address: '',
    group: [],
    newGroups: [],
});

const headers = [
    { title: '姓名', key: 'name', sortable: true, width: '16%' },
    { title: 'Email', key: 'address', sortable: false, width: '16%' },
    { title: '所屬群組', key: 'group', sortable: false, width: '52%' },
    { title: '動作 (編輯、刪除)', key: 'actions', sortable: false, width: '16%' },
];

// functions
const closePatchPerson = async () => {
    patchPersonDialog.value = false;
    await resetPersonUser();
    await refreshPage();
}

const deletePerson = async (person) => {
    deletePersonDialog.value = true;
    resetPersonUser();
    personUser.value.name = person.name;
    personUser.value.address = person.address;
}

const getGroupList = async () => {
    try {
        const getGroupResponse = await axios.get(`/group`);
        if (getGroupResponse?.status == 200) {
            groupList.value.splice(0, groupList.value.length, ...getGroupResponse.data.filter(group => group.type !== 'OUTLOOK').map(group => group.groupName))
        }
    } catch (error) {
        console.error('Error fetching groups:', error);
    }
}

const getPerson = async () => {
    try {
        const getPersonResponse = await axios.get(`/person`);

        if (getPersonResponse?.status == 200) {
            person.value.splice(0, person.value.length, ...getPersonResponse.data)
        }
    } catch (error) {
        console.error('Error fetching groups:', error);
    }
};

const patchPerson = async (person) => {
    patchPersonDialog.value = true;
    resetPersonUser();
    personUser.value.name = person.name;
    personUser.value.newName = person.name;
    personUser.value.address = person.address;
    person.group.forEach(group => {
        personUser.value.group.push(group.groupName);
        personUser.value.newGroups.push(group.groupName);
    });
};

const refreshPage = async () => {
    await getPerson();
    await getGroupList();
};

const resetPersonUser = () => {
    personUser.value = {
        name: '',
        newName: '',
        address: '',
        group: [],
        newGroups: [],
    };
};

const saveDeletePerson = async () => {
    try {
        const deletePersonResponse = await axios.delete(`/person/${personUser.value.address}`);
        if (deletePersonResponse?.status == 200) {
            deletePersonDialog.value = false;
            await resetPersonUser();
            await refreshPage();
        }
    } catch (error) {
        console.error('Failed to delete person:', error)
    }
}

const savePatchGroup = async () => {
    if (!personUser.value.group) {
        personUser.value.group = [];
    }
    if (!personUser.value.newGroups) {
        personUser.value.newGroups = [];
    }
    let onlyInGroups = personUser.value.group.filter(group => !personUser.value.newGroups.includes(group));
    let onlyInNewGroups = personUser.value.newGroups.filter(group => !personUser.value.group.includes(group));

    if (personUser.value.newName !== personUser.value.name) {
        try {
            const patchPersonResponse = await axios.patch(`/person/${personUser.value.address}`, {
                name: personUser.value.newName,
            });
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    }
    if (onlyInGroups) {
        try {
            onlyInGroups.forEach(async (groupName) => {
                await axios.delete(`/group/${groupName}/person/${personUser.value.address}`);
            });
        } catch (error) {
            console.error('Error deleting groups:', error);
        }
    }
    if (onlyInNewGroups) {
        try {
            onlyInNewGroups.forEach(async (groupName) => {
                // add group
                if (!groupList.value.includes(groupName)) {
                    try {
                        await axios.post(`/group`, JSON.stringify({
                            "name": groupName,
                            "descriptiveName": groupName,
                            "description": groupName,
                            "type": 'LOCAL',
                        }));
                    } catch (error) {
                        console.error('Error adding groups:', error);
                    }
                }
                // add person to group
                await axios.post(`/group/${groupName}/person`, JSON.stringify({
                    'address': personUser.value.address,
                    "name": personUser.value.newName,
                }));
            });
            await refreshPage();
        } catch (error) {
            console.error('Error adding groups:', error);
        }
    }
    patchPersonDialog.value = false;
    await refreshPage();
};

// main
refreshPage();

</script>

<template>
    <v-container fluid>
        <v-card flat>
            <v-card-title class="d-flex align-center pe-2">
                &nbsp;通訊錄管理(人員管理) &nbsp;
                <v-chip prepend-icon="mdi mdi-account-multiple" variant="outlined">
                    總人員數 x {{ person.length }}
                </v-chip>

                <v-spacer></v-spacer>

                <v-text-field v-model="search" density="compact" label="Search" prepend-inner-icon="mdi-magnify"
                    variant="solo-filled" flat hide-details single-line></v-text-field>
            </v-card-title>

            <v-divider></v-divider>

            <v-data-table v-model:search="search" :headers="headers" :items="person">
                <template v-slot:item.group="{ item }">
                    <v-chip v-for="group in item.group" :key="group" :color="group.type == 'OUTLOOK' ? 'blue' : 'green'"
                        :text="group.groupName" class="text-uppercase me-2" size="small" label></v-chip>
                </template>
                <template v-slot:item.actions="{ item }">
                    <v-icon class="me-2" size="small" @click="patchPerson(item)">
                        mdi-pencil
                    </v-icon>
                    &nbsp;
                    <v-icon size="small" @click="deletePerson(item)">
                        mdi-delete
                    </v-icon>
                </template>
            </v-data-table>
        </v-card>

        <!-- dialog -->

        <v-dialog v-model="patchPersonDialog" width="auto">
            <v-form>
                <v-card min-width="500" max-width="100%" prepend-icon="mdi mdi-account-edit" title="編輯人員資料">
                    <v-card-item>
                        <v-text-field v-model="personUser.address" label="Address" prepend-icon="mdi mdi-email"
                            variant="underlined" readonly></v-text-field>
                        <v-text-field v-model="personUser.newName" clearable label="Name" prepend-icon="mdi mdi-account"
                            variant="underlined"></v-text-field>
                        <v-combobox v-model="personUser.newGroups" :items="groupList" clearable chips closable-chips
                            label="Groups" multiple prepend-icon="mdi mdi-account-multiple-plus"
                            variant="underlined"></v-combobox>
                    </v-card-item>
                    <template v-slot:actions>
                        <v-spacer></v-spacer>
                        <v-btn variant="outlined" @click="closePatchPerson()">
                            取消
                        </v-btn>
                        <v-btn variant="outlined" @click="savePatchGroup()">
                            儲存人員
                        </v-btn>
                    </template>
                </v-card>
            </v-form>
        </v-dialog>

        <v-dialog v-model="deletePersonDialog" width="auto">
            <v-sheet class="pa-4 text-center mx-auto" elevation="12" min-width="400" max-width="600" rounded="lg"
                width="100%">
                <!-- <v-icon class="mb-5" color="warning" icon="mdi-check-circle" size="112"></v-icon> -->
                <img src="../../assets/trash.png" alt="Image" style="width: 400px;">

                <h2 class="text-h5 mb-6">是否刪除 {{ personUser.name }} 人員</h2>

                <p class="mb-4 text-medium-emphasis text-body-2">
                    如果你不想刪除這個人員，請按取消。<br>
                    Otherwise, you're done!
                </p>

                <v-divider class="mb-4"></v-divider>

                <div class="text-end">
                    <v-btn class="text-none" color="success" variant="flat" width="90" rounded
                        @click="saveDeletePerson()">
                        確定刪除
                    </v-btn>
                </div>
            </v-sheet>
        </v-dialog>
    </v-container>
</template>