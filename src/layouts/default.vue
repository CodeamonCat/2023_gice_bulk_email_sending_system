<template>
  <v-layout style="max-height: 100dvh">
    <!-- <DefaultBar /> -->
    <DefaultNavigation />
    <DefaultView />
    <DefaultFooter />
  </v-layout>
</template>

<script lang="ts" setup>
  // import DefaultBar from './default/AppBar.vue'
  import DefaultView from './default/View.vue'
  import DefaultNavigation from './default/Navigation.vue'
  import DefaultFooter from './default/Footer.vue'
</script>
