<script setup>
import { useRoute } from 'vue-router';
import axios from '@/plugins/axios';

// UI variables
const route = useRoute();
const search = ref('');
const patchPersonDialog = ref(false);

// variables
const groupName = route.query.name;
const groupInfo = ref([]);

const personUser = ref({
    name: '',
    newName: '',
    address: '',
    status: '',
});

const headers = [
    { title: '姓名', key: 'name', sortable: true, width: '50%' },
    { title: 'Email', key: 'address', sortable: false, width: '50%' },
];

// functions
const closePatchPerson = async () => {
    await resetPersonUser();
    await refreshPage();
    patchPersonDialog.value = false;
}

const deletePerson = async (person) => {
    try {
        const deletePersonResponse = await axios.delete(`/person/${person.address}`);
        if (deletePersonResponse?.status == 200) {
            await refreshPage();
        }
    } catch (error) {
        console.error('Failed to delete person:', error);
    }
}

const patchPerson = async (person) => {
    if (person) {
        personUser.value = {
            name: person.name,
            newName: person.name,
            address: person.address,
            status: 'PATCH'
        };
    }
    patchPersonDialog.value = true;
}

const getGroupInfo = async () => {
    groupInfo.value = [];
    try {
        const getGroupInfoResponse = await axios.get(`/group/${groupName}`);
        if (getGroupInfoResponse?.status == 200) {
            groupInfo.value = getGroupInfoResponse.data[0];
            if (groupInfo.value.type === 'LOCAL' && headers.length < 3) {
                headers.push({ title: '動作', key: 'actions', sortable: false });
            }
        }
    } catch (error) {
        console.error(error);
    }
};

const refreshPage = async () => {
    await getGroupInfo();
}

const resetPersonUser = () => {
    personUser.value = {
        name: '',
        newName: '',
        address: '',
        status: '',
    };
};

const savePatchGroup = async () => {
    if (personUser.value.status === 'PATCH') {
        try {
            const patchPersonResponse = await axios.patch(`/person/${personUser.value.address}`, JSON.stringify({
                'name': personUser.value.newName,
            }));
            if (patchPersonResponse?.status == 201) {
                patchPersonDialog.value = false;
                await resetPersonUser();
                await refreshPage();
            }
        } catch (error) {
            console.error('Failed to patch person:', error);
        }
    } else {
        // add new person to the group
        try {
            const addPersonResponse = await axios.post(`/group/${groupName}/person`, JSON.stringify({
                'name': personUser.value.newName,
                'address': personUser.value.address,
            }));
            if (addPersonResponse?.status == 201) {
                patchPersonDialog.value = false;
                await resetPersonUser();
                await refreshPage();
            }
        } catch (error) {
            console.error('Failed to add person:', error);
        }
    }
}

// main
refreshPage();

</script>

<template>
    <v-container fluid>
        <v-card flat>
            <v-card-title class="d-flex align-center pe-2">
                <!-- <v-icon icon="mdi mdi-account-switch"></v-icon> -->
                &nbsp;{{ groupInfo.descriptiveName }} &nbsp;
                <v-chip prepend-icon="mdi mdi-account-multiple" variant="outlined">
                    總人員數 x {{ groupInfo.length }}
                </v-chip>
                &nbsp;
                <v-chip :color="groupInfo.type == 'OUTLOOK' ? 'blue' : 'green'" prepend-icon="mdi mdi-account-multiple"
                    variant="outlined">
                    {{ groupInfo.type === 'OUTLOOK' ? 'OUTLOOK信件群組' : 'LOCAL信件群組' }}
                </v-chip>

                <v-spacer></v-spacer>

                <v-text-field v-model="search" density="compact" label="Search" prepend-inner-icon="mdi-magnify"
                    variant="solo-filled" flat hide-details single-line></v-text-field>
                &nbsp;&nbsp;
                <v-btn v-if="groupInfo.type == 'LOCAL'" class="mb-2" color="primary" variant="outlined" dark
                    @click="patchPerson()">
                    新增人員
                </v-btn>
            </v-card-title>

            <v-divider></v-divider>

            <v-data-table v-model:search="search" :headers="headers" :items="groupInfo.person">
                <template v-if="groupInfo.type == 'LOCAL'" v-slot:item.actions="{ item }">
                    <v-icon class="me-2" size="small" @click="patchPerson(item)">
                        mdi mdi-pencil-plus
                    </v-icon>
                    <v-icon class="me-2" size="small" @click="deletePerson(item)">
                        mdi mdi-trash-can-outline
                    </v-icon>
                </template>
            </v-data-table>
        </v-card>

        <!-- dialog -->

        <v-dialog v-model="patchPersonDialog" width="auto">
            <v-form>
                <v-card min-width="500" max-width="100%" prepend-icon="mdi mdi-account-edit" title="編輯人員資料">
                    <v-card-item>
                        <v-text-field v-model="personUser.address" clearable label="Address"
                            prepend-icon="mdi mdi-email" variant="underlined"></v-text-field>
                        <v-text-field v-model="personUser.newName" clearable label="Name" prepend-icon="mdi mdi-account"
                            variant="underlined"></v-text-field>
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
    </v-container>
</template>
