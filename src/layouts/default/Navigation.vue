<script setup>
async function logout() {
    localStorage.removeItem('apiToken')
    location.href = '#'
    location.reload()
}
</script>

<template>
    <v-navigation-drawer expand-on-hover rail>
        <v-list>
            <v-list-item prepend-icon="mdi-email-fast-outline" title="臺大電信工程學研究所" subtitle="大量寄信系統"></v-list-item>
        </v-list>
        <v-divider></v-divider>
        <v-list density="compact" nav>
            <v-list-item prepend-icon="mdi-email" title="信件管理" value="index"
                @click="$router.push({ path: '/' })"></v-list-item>
            <v-list-item prepend-icon="mdi-account-group-outline" title="通訊錄管理(群組管理)" value="group"
                @click="$router.push({ path: '/group' })"></v-list-item>
            <v-list-item prepend-icon="mdi mdi-account-switch" title="通訊錄管理(人員管理)" value="people"
                @click="$router.push({ path: '/people' })"></v-list-item>
        </v-list>
        <template v-slot:append>
            <v-list density="compact" nav>
                <v-list-item prepend-icon="mdi-logout" title="登出" @click="logout"></v-list-item>
            </v-list>
        </template>
    </v-navigation-drawer>
</template>