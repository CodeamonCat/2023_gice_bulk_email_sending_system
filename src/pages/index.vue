<script setup>
import { ref } from "vue";
import { shallowRef } from "vue";
import CKEditor from "@ckeditor/ckeditor5-vue";
import DecoupledEditor from "@ckeditor/ckeditor5-build-decoupled-document";
import { mergeProps } from "vue";

import { default as axios, apiToken } from "../plugins/axios";
import CkeditorUtil from "../plugins/juice";
import { MyUploadAdapter } from "../plugins/upload_adapter";

// UI variables
const bccVisible = ref(false);
const ccVisible = ref(false);
const deleteDialog = ref(false);
const dialog = shallowRef(false);
const expanded = ref([]);

// create email variables
const email = ref({
  subject: [""],
  from: ["ntugice@ntu.edu.tw"],
  to: [],
  cc: [],
  bcc: [],
  html: [""],
  attachments: [],
  instant: false,
});

// variables
const groupList = ref([]);
const mails = ref([]);
const mailLength = ref(0);
const loading = ref(false);
const page = ref(1);
const itemsPerPage = ref(10);
const sortBy = ref(null);
const deleteID = ref(null);

const headers = [
  { title: "建立時間", key: "createdAt" },
  { title: "信件名稱", key: "name", sortable: false },
  { title: "收件者概要", key: "recipients", sortable: false },
  { title: "信件優先順序", key: "instant" },
  { title: "操作選項", key: "actions", sortable: false },
  { title: "信件詳情", key: "data-table-expand", sortable: false },
];

// functions
const deleteItem = async (item) => {
  deleteDialog.value = true;
  deleteID.value = item.id;
};

const emailRule = (v) => {
  return (
    !!(v || "").trim().match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/) ||
    "Please enter a valid email"
  );
};

const getGroupList = async () => {
  try {
      const getGroupResponse = await axios.get(`/group`);
      if (getGroupResponse?.status == 200) {
          groupList.value.splice(0, groupList.value.length, ...getGroupResponse.data.map(group => group.groupName))
      }
  } catch (error) {
      console.error('Error fetching groups:', error);
  }
}

const getPersonName = async (email) => {
  try {
    const getPersonResponse = await axios.get(`/person/${email}`, {
      silenceError: true
    });
    if (getPersonResponse?.status == 200) {
      return getPersonResponse.data[0].name;
    } else {
      return null;
    }
  } catch (error) {
    return null
  }
};

const loadDetails = async (newVal) => {
  const diff = newVal.filter((x) => !expanded.value.includes(x));
  expanded.value = newVal;

  mails.value
    .filter(({ id }) => diff.includes(id))
    .forEach(async (mail) => {
      try {
        const fd = await fetch(
          `${import.meta.env.VITE_APP_API_URL}/parse-raw?uuid=${mail.raw}`,
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
            },
          }
        ).then((res) => res.formData());
        mail.email = JSON.parse(fd.get("email"));
        mail.email.attachments = fd
          .getAll("attachment[]")
          .map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
        // filter recipients to get bcc list
        const temp = mail.recipients.map((recipient) => ({
          address: recipient.address,
          name: recipient.name ? recipient.name : "",
        }));
        mail.email.bcc = temp.filter(
          (recipient) =>
            !mail.email.to.some(
              ({ address }) => address === recipient.address
            ) &&
            !mail.email.cc.some(({ address }) => address === recipient.address)
        );
      } catch (error) {
        console.error("Failed to fetch mail details:", error);
      }
    });
};

const loadItems = async ({ page, itemsPerPage, sortBy }) => {
  loading.value = true;
  try {
    const getMailResponse = await axios.get(`/mail`, {
      params: {
        pageSize: itemsPerPage,
        pageNum: page,
      },
    });
    if (getMailResponse?.status != 200) return;
    mails.value.splice(0, mails.value.length, ...getMailResponse.data.content);
    mailLength.value = getMailResponse.data.count;
    loading.value = false;
  } catch (error) {
    console.error("Failed to fetch mails:", error);
  }
};

const refreshPage = async () => {
  await loadItems({
    page: page.value,
    itemsPerPage: itemsPerPage.value,
    sortBy: sortBy.value,
  });
  await getGroupList();
};

const resetMail = () => {
  email.value.subject = "";
  email.value.to = [];
  email.value.cc = [];
  email.value.bcc = [];
  email.value.html = "";
  email.value.attachments = [];
  email.value.instant = false;
};

const saveDeleteItem = async () => {
  try {
    const deleteResponse = await axios.delete(`/mail/${deleteID.value}`);
    if (deleteResponse?.status == 200) {
      deleteID.value = null;
      deleteDialog.value = false;
      await refreshPage();
    }
  } catch (error) {
    console.error("Failed to delete mail:", error);
  }
};

const submit = async () => {
  // get email html and compose CSS styles
  email.value.html = CkeditorUtil.getContentWithLineStyles(editor_data.value);

  try {
    const fd = new FormData();
    fd.append(
      "email",
      JSON.stringify({
        subject: email.value.subject,
        from: email.value.from[0],
        to: email.value.to,
        cc: email.value.cc,
        bcc: email.value.bcc,
        html: email.value.html,
      })
    );

    email.value.attachments.forEach((file) => {
      fd.append("attachment[]", file);
    });

    // send email to get composed raw email
    const composeRawResponse = await axios.post("/compose-raw", fd, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (composeRawResponse?.status == 200) {
      dialog.value = false;

      const addresses = [
        ...email.value.to,
        ...email.value.cc,
        ...email.value.bcc,
      ];

      const personNames = await Promise.all(
        addresses.map((address) => getPersonName(address))
      );

      const mailData = {
        name: email.value.subject,
        recipients: addresses.map((address, index) => ({
          name: personNames[index],
          address,
        })),
        raw: composeRawResponse.data.uuid,
        instant: email.value.instant,
      };

      try {
        const mailResponse = await axios.post(`/mail`, mailData, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (mailResponse?.status == 200) {
          resetMail();
          await refreshPage();
        }
      } catch (error) {
        console.error("Failed to send email:", error);
      }
    }
  } catch (error) {
    console.error("Failed to send email:", error);
  }
};

// CKEditor 5
const ckeditor = CKEditor.component;
const editor = DecoupledEditor;
const editor_data = ref("");
const onReady = (editor) => {
  editor.ui
    .getEditableElement()
    .parentElement.insertBefore(
      editor.ui.view.toolbar.element,
      editor.ui.getEditableElement()
    );
};

function MyCustomUploadAdapterPlugin(editor) {
  editor.plugins.get("FileRepository").createUploadAdapter = (loader) => {
    return new MyUploadAdapter(loader);
  };
}

// main
refreshPage();

</script>

<template>
  <v-container fluid>
    <v-data-table-server
      v-model:items-per-page="itemsPerPage"
      :headers="headers"
      :items="mails"
      :loading="loading"
      :items-length="mailLength"
      :expanded="expanded"
      @update:expanded="loadDetails"
      @update:options="loadItems"
    >
      <!-- table header -->
      <template v-slot:top>
        <v-toolbar flat>
          <v-toolbar-title>所有信件 ({{ mails.length }})</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-dialog
            v-model="dialog"
            max-width="60%"
            min-width="600px"
            :retain-focus="false"
            persistent
            no-click-animation
          >
            <template v-slot:activator="{ props: activatorProps }">
              <v-btn
                v-bind="activatorProps"
                class="mb-2"
                color="primary"
                dark
                prepend-icon="mdi mdi-email"
                text="建立新信件"
                variant="tonal"
              ></v-btn>
            </template>

            <v-form>
              <v-card prepend-icon="mdi mdi-email" title="建立新信件">
                <v-card-text>
                  <v-row dense no-gutters>
                    <v-col>
                      <v-text-field
                        v-model="email.subject"
                        required
                        label="Subject"
                        variant="underlined"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters>
                    <v-col>
                      <v-combobox
                        v-model="email.from"
                        chips
                        label="From* (default)"
                        readonly
                        variant="underlined"
                      ></v-combobox>
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters>
                    <v-col>
                      <v-combobox
                        v-model="email.to"
                        :items="groupList"
                        :rules="[
                          (arr) =>
                            arr
                              .map((arr) => emailRule(arr))
                              .filter((item) => item !== true)[0] ?? true,
                        ]"
                        required
                        auto-grow
                        chips
                        clearable
                        closable-chips
                        label="Recipients*"
                        multiple
                        variant="underlined"
                      ></v-combobox>
                    </v-col>
                    <v-col cols="auto" class="d-flex align-center">
                      <v-chip
                        density="compact"
                        :prepend-icon="ccVisible ? 'mdi-minus' : 'mdi-plus'"
                        variant="text"
                        @click="
                          (ccVisible = !ccVisible),
                            ccVisible && (email.cc = null)
                        "
                        >Cc</v-chip
                      >
                      <v-chip
                        density="compact"
                        :prepend-icon="bccVisible ? 'mdi-minus' : 'mdi-plus'"
                        variant="text"
                        @click="
                          (bccVisible = !bccVisible),
                            bccVisible && (email.bcc = null)
                        "
                        >Bcc</v-chip
                      >
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters v-if="ccVisible">
                    <v-col>
                      <v-combobox
                        v-model="email.cc"
                        :items="groupList" 
                        :rules="[
                          (arr) =>
                            arr
                              .map((arr) => emailRule(arr))
                              .filter((item) => item !== true)[0] ?? true,
                        ]"
                        auto-grow
                        chips
                        clearable
                        closable-chips
                        label="Cc"
                        multiple
                        variant="underlined"
                      ></v-combobox>
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters v-if="bccVisible">
                    <v-col>
                      <v-combobox
                        v-model="email.bcc"
                        :items="groupList" 
                        :rules="[
                          (arr) =>
                            arr
                              .map((arr) => emailRule(arr))
                              .filter((item) => item !== true)[0] ?? true,
                        ]"
                        auto-grow
                        chips
                        clearable
                        closable-chips
                        label="Bcc"
                        multiple
                        variant="underlined"
                      ></v-combobox>
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters>
                    <v-col class="ck-wrapper">
                      <!-- CKEditor 5 -->
                      <ckeditor
                        v-model="editor_data"
                        :editor="editor"
                        :config="{
                          extraPlugins: [MyCustomUploadAdapterPlugin],
                        }"
                        @ready="onReady"
                        :style="{ border: '1px solid black' }"
                      >
                      </ckeditor>
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters>
                    <v-file-input
                      v-model="email.attachments"
                      chips
                      counter
                      label="File input w/ chips"
                      multiple
                      show-size
                      variant="underlined"
                    ></v-file-input>
                  </v-row>
                  <small class="text-caption text-medium-emphasis"
                    >*indicates required field</small
                  >
                </v-card-text>
                <v-divider></v-divider>
                <v-card-actions>
                  <v-row dense style="align-items: top">
                    <v-spacer></v-spacer>
                    <v-tooltip location="bottom" no-click-animation>
                      <template v-slot:activator="{ props }">
                        <v-checkbox
                          v-model="email.instant"
                          v-bind="props"
                          label="立即送出&nbsp;&nbsp"
                          density="compact"
                        ></v-checkbox>
                      </template>
                      <p>預設：排程送出</p>
                    </v-tooltip>
                    <v-btn
                      text="Close"
                      variant="tonal"
                      @click="dialog = false"
                    ></v-btn>
                    <v-btn
                      color="primary"
                      text="Save"
                      variant="tonal"
                      @click="submit()"
                    ></v-btn>
                  </v-row>
                </v-card-actions>
              </v-card>
            </v-form>
          </v-dialog>
        </v-toolbar>
      </template>

      <!-- table body -->
      <template v-slot:item.createdAt="{ item }">
        {{
          new Date(item.createdAt).toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        }}
      </template>

      <template v-slot:item.name="{ item }">
        <p>
          {{
            item.name.length < 20
              ? item.name
              : item.name.split(" ").slice(0, 20).join(" ") + " ..."
          }}
        </p>
      </template>

      <template v-slot:item.recipients="{ item }">
        <v-badge
          :content="
            item.recipients.filter(
              (recipient) =>
                recipient.results.length >= 0 &&
                recipient.results.every((result) => result.success)
            ).length
          "
          color="success"
          inline
          >已成功寄出&nbsp;</v-badge
        >
        <v-badge
          :content="
            item.recipients.filter(
              (recipient) =>
                recipient.results.length >= 0 &&
                recipient.results.every((result) => !result.success)
            ).length
          "
          color="error"
          inline
          >尚未寄出&nbsp;</v-badge
        >
        <v-badge
          :content="
            item.recipients.filter((recipient) => recipient.results.length >= 0)
              .length
          "
          color="info"
          inline
          >信件總數&nbsp;</v-badge
        >
      </template>

      <template v-slot:item.instant="{ item }">
        <v-chip :color="item.instant ? 'green' : 'gray'" variant="outlined">
          {{ item.instant ? "立即送出" : "排程送出" }}
        </v-chip>
      </template>

      <template v-slot:item.actions="{ item }">
        <v-icon size="small" @click="deleteItem(item)"> mdi-delete </v-icon>
      </template>

      <template v-slot:expanded-row="{ columns, item }">
        <tr style="box-shadow: 0 0 5px 0px #ddd inset">
          <td :colspan="columns.length">
            <!-- editing here -->
            <table v-if="item.email" style="width: 100%; margin: 10px 0">
              <tr>
                <td :colspan="1"></td>
                <td :colspan="columns.length - 1">
                  {{ item.name }}
                </td>
              </tr>
              <tr>
                <td :colspan="1" :rowspan="2" style="text-align: center">
                  <v-icon
                    icon="mdi mdi-account-circle"
                    color="#E0E0E0"
                    size="48"
                  />
                </td>
                <td
                  :colspan="columns.length - 1"
                  style="vertical-align: bottom"
                >
                  <strong>{{ item.email.from[0].address }}</strong>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top">
                  <!-- recipient to list -->
                  <template
                    v-if="item.email.to && item.email.to.length >= 5"
                  >
                    <template v-for="recipient in item.email.to.slice(0, 1)">
                      {{
                        recipient.name
                          ? recipient.name + " <" + recipient.address + ">"
                          : recipient.address
                      }}
                    </template>
                    <template v-for="recipient in item.email.to.slice(1, 5)">
                      {{
                        recipient.name
                          ? ", " +
                            recipient.name +
                            " <" +
                            recipient.address +
                            ">"
                          : ", " + recipient.address
                      }}
                    </template>
                  </template>
                  <template v-else>
                    <template v-for="recipient in item.email.to.slice(0, 1)">
                      {{
                        recipient.name
                          ? recipient.name + " <" + recipient.address + ">"
                          : recipient.address
                      }}
                    </template>
                    <template v-for="recipient in item.email.to.slice(1)">
                      {{
                        recipient.name
                          ? ", " +
                            recipient.name +
                            " <" +
                            recipient.address +
                            ">"
                          : ", " + recipient.address
                      }}
                    </template>
                    <template
                      v-if="
                        item.email.to.length <= 4 && item.email.cc.length > 0
                      "
                    >
                      <template
                        v-for="recipient in item.email.cc.slice(
                          0,
                          4 - item.email.cc.length
                        )"
                      >
                        {{
                          recipient.name
                            ? ", " +
                              recipient.name +
                              " <" +
                              recipient.address +
                              ">"
                            : ", " + recipient.address
                        }}
                      </template>
                    </template>
                  </template>
                  <v-menu>
                    <template v-slot:activator="{ props: menu }">
                      <v-tooltip location="top">
                        <template v-slot:activator="{ props: tooltip }">
                          <v-btn
                            icon="mdi-chevron-down"
                            variant="text"
                            color="primary"
                            v-bind="mergeProps(menu, tooltip)"
                          ></v-btn>
                        </template>
                        <span>顯示詳細資訊</span>
                      </v-tooltip>
                    </template>

                    <v-card
                      min-width="200"
                      max-width="300"
                      location="bottom center"
                      origin="auto"
                    >
                      <div
                        style="
                          display: grid;
                          grid-template-columns: auto auto;
                          margin: 16px;
                          gap: 4px 8px;
                        "
                      >
                        <div style="vertical-align: top; text-align: right">
                          From:
                        </div>
                        <div>
                          {{
                            item.email.from[0].name
                              ? item.email.from[0].name +
                                " <" +
                                item.email.from[0].address +
                                ">"
                              : item.email.from[0].address
                          }}
                        </div>
                        <div
                          v-if="item.email.to.length > 0"
                          style="vertical-align: top; text-align: right"
                        >
                          To:
                        </div>
                        <div
                          v-if="item.email.to.length > 0"
                          v-html="
                            item.email.to
                              .map((recipient) =>
                                recipient.name
                                  ? recipient.name +
                                    ' <' +
                                    recipient.address +
                                    '>'
                                  : recipient.address
                              )
                              .join('<br/>')
                          "
                        ></div>
                        <div
                          v-if="item.email.cc.length > 0"
                          style="vertical-align: top; text-align: right"
                        >
                          CC:
                        </div>
                        <div
                          v-if="item.email.cc.length > 0"
                          v-html="
                            item.email.cc
                              .map((recipient) => recipient.address)
                              .join('<br/>')
                          "
                        ></div>
                        <div
                          v-if="item.email.bcc.length > 0"
                          style="vertical-align: top; text-align: right"
                        >
                          BCC:
                        </div>
                        <div
                          v-if="item.email.bcc.length > 0"
                          v-html="
                            item.email.bcc
                              .map((recipient) =>
                                recipient.name
                                  ? recipient.name +
                                    ' <' +
                                    recipient.address +
                                    '>'
                                  : recipient.address
                              )
                              .join('<br/>')
                          "
                        ></div>
                        <div style="vertical-align: top; text-align: right">
                          Date:
                        </div>
                        <div>
                          {{
                            new Date(item.createdAt).toLocaleString("zh-TW", {
                              timeZone: "Asia/Taipei",
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          }}
                        </div>
                      </div>
                    </v-card>
                  </v-menu>
                </td>
              </tr>
              <tr>
                <td :colspan="1"></td>
                <td :colspan="columns.length - 1">
                  <hr
                    style="
                      border-width: 1px 0 0 0;
                      border-color: rgba(0, 0, 0, 0.12);
                    "
                  />
                </td>
              </tr>
              <tr>
                <td :colspan="1"></td>
                <td :colspan="columns.length - 1">
                  <div v-html="item.email.html"></div>
                </td>
              </tr>
              <tr>
                <td :colspan="1"></td>
                <td :colspan="columns.length - 1">
                  <hr
                    style="
                      border-width: 1px 0 0 0;
                      border-color: rgba(0, 0, 0, 0.12);
                    "
                  />
                </td>
              </tr>
              <tr>
                <td :colspan="1"></td>
                <td :colspan="columns.length - 1">
                  <a
                    v-for="(file, atmtIndex) in item.email.attachments"
                    :key="`mail-${item.id}atmt-${atmtIndex}`"
                    :download="file.name"
                    :href="file.url"
                    style="margin-right: 8px"
                    >{{ file.name }}</a
                  >
                </td>
              </tr>
            </table>
            <v-skeleton-loader v-else type="paragraph" />
          </td>
        </tr>
      </template>
    </v-data-table-server>

    <!-- dialog -->

    <v-dialog v-model="deleteDialog" width="auto">
      <v-sheet
        class="pa-4 text-center mx-auto"
        elevation="12"
        min-width="400"
        max-width="600"
        rounded="lg"
        width="100%"
      >
        <!-- <v-icon class="mb-5" color="warning" icon="mdi-check-circle" size="112"></v-icon> -->
        <img src="../assets/trash.png" alt="Image" style="width: 400px" />

        <h2 class="text-h5 mb-6">是否刪除此信件</h2>

        <p class="mb-4 text-medium-emphasis text-body-2">
          如果你不想刪除這個信件，請按取消。<br />
          Otherwise, you're done!
        </p>

        <v-divider class="mb-4"></v-divider>

        <div class="text-end">
          <v-btn
            class="text-none"
            color="success"
            variant="flat"
            width="90"
            rounded
            @click="saveDeleteItem()"
          >
            確定刪除
          </v-btn>
        </div>
      </v-sheet>
    </v-dialog>
  </v-container>
</template>

<style>
.ck-wrapper > .ck-content {
  min-height: 300px;
}
</style>

<style scoped>
.ck-wrapper >>> ul,
.ck-wrapper >>> ol {
  margin: revert;
  padding: revert;
}
</style>
