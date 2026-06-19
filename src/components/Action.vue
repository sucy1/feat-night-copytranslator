<template>
  <div :class="['action-item', actionLayoutClass]">
    <v-tooltip v-if="action" bottom open-delay="100" :disabled="!tooltip">
      <template v-slot:activator="{ on, attrs }">
        <div class="actionStyle" v-bind="attrs" v-on="on">
          <div v-if="action.actionType === 'checkbox'" class="action-row">
            <span class="action-label">{{ trans[action.id] }}</span>
            <v-switch
              v-model="value"
              class="action-switch"
              hide-details
            ></v-switch>
          </div>
          <v-dialog
            v-else-if="action.id === 'newConfigSnapshot'"
            v-model="dialog"
          >
            <template v-slot:activator="{ on, attrs }">
              <SimpleButton v-bind="attrs" v-on="on" class="actionButton">
                {{ trans[identifier] }}
              </SimpleButton>
            </template>
            <v-card>
              <v-text-field
                class="mytext"
                v-model="text"
                :rules="rules"
                :label="trans['snapshotPrompt']"
              ></v-text-field>
              <SimpleButton
                @click="
                  callback(identifier, text);
                  dialog = false;
                  text = '';
                "
                :disabled="invalidSnapshotName"
                class="actionButton"
                >{{ trans[identifier] }}
              </SimpleButton>
            </v-card>
          </v-dialog>
          <v-menu offset-y v-else-if="action.actionType === 'param_normal'">
            <template v-slot:activator="{ on, attrs }">
              <SimpleButton v-bind="attrs" v-on="on" class="actionButton">
                {{ trans[action.id] }}
              </SimpleButton>
            </template>
            <v-list>
              <v-list-item
                v-for="(item, index) in action.submenu"
                :key="index"
                @click="callback(item.id)"
              >
                <v-list-item-title>{{ item.label }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <v-dialog v-else-if="action.actionType == 'color_picker'">
            <template v-slot:activator="{ on, attrs }">
              <SimpleButton v-bind="attrs" v-on="on" class="actionButton">
                <span class="action-button-content">
                  <span>{{ trans[action.id] }}</span>
                  <span
                    class="action-color-preview"
                    :style="{ background: color }"
                  ></span>
                </span>
              </SimpleButton>
            </template>
            <v-color-picker
              v-model="color"
              flat
              :swatches="swatches"
              show-swatches
              style="margin: 10px auto;"
            ></v-color-picker>
          </v-dialog>
          <p
            v-else-if="action.actionType === 'prompt'"
            style="text-align: left; font-weight: bold;"
            class="pStyle"
          >
            {{ trans[action.id] }}
          </p>
          <MultiSelect
            v-else-if="action.actionType === 'multi_select'"
            :identifier="action.id"
          ></MultiSelect>
          <div v-else-if="action.actionType === 'constant'" class="action-row">
            <span class="action-label">{{ trans[identifier] }}</span>
            <v-text-field
              v-model="value"
              class="action-control"
              dense
              hide-details
            ></v-text-field>
          </div>
          <div v-else-if="action.actionType === 'submenu'" class="action-row">
            <span class="action-label">{{ trans[identifier] }}</span>
            <v-select
              v-model="command"
              :items="action.submenu"
              item-text="label"
              item-value="id"
              class="action-control"
              dense
              hide-details
            >
            </v-select>
          </div>
          <div v-else-if="action.actionType === 'normal'">
            <SimpleButton @click="callback(action.id)" class="actionButton">
              {{ trans[action.id] }}
            </SimpleButton>
          </div>
        </div>
      </template>
      <span>{{ tooltip }}</span>
    </v-tooltip>
  </div>
</template>

<script lang="ts">
import {
  Identifier,
  compose,
  ActionView,
  swatches,
  snapshotNameRules,
  isValidSnapshotName,
} from "../common/types";
import { Prop, Component } from "vue-property-decorator";
import MultiSelect from "./MultiSelect.vue";
import bus from "../common/event-bus";
import Base from "@/components/Base.vue";
import SimpleButton from "./SimpleButton.vue";
import { ColorConfig } from "@/common/rule";

@Component({
  components: { MultiSelect, SimpleButton },
})
export default class Action extends Base {
  @Prop({ default: undefined }) readonly identifier!: Identifier;
  action: ActionView = this.$controller.action.getAction(this.identifier);

  swatches = swatches; //调色盘的预定义颜色
  dialog: boolean = false;

  text: string = "";

  rules = snapshotNameRules;

  get invalidSnapshotName() {
    return !isValidSnapshotName(this.text);
  }

  get tooltip(): undefined | string {
    if (!this.action || this.action.actionType === "prompt") {
      return undefined;
    }
    const tp = this.trans[`<tooltip>${this.action.id}`];
    return tp;
  }

  get command() {
    return compose([this.identifier, this.value.toString()]);
  }

  set command(cmd) {
    this.callback(cmd);
  }

  get value() {
    return this.$store.state.config[this.identifier];
  }

  set value(val) {
    this.callback(this.identifier, val);
  }

  get color() {
    const color = this.value as ColorConfig;
    if (this.$vuetify.theme.dark) {
      return color.dark;
    } else {
      return color.light;
    }
  }

  set color(val) {
    if (this.$vuetify.theme.dark) {
      this.callback(this.identifier, { ...this.value, dark: val });
    } else {
      this.callback(this.identifier, { ...this.value, light: val });
    }
  }

  async sync() {
    this.action = this.$controller.action.getAction(this.identifier);
  }

  mounted() {
    if (["submenu", "param_normal"].includes(this.action.actionType)) {
      bus.gon(this.identifier, this.sync);
    }
  }

  get actionLayoutClass() {
    if (!this.action) {
      return "";
    }
    if (["prompt", "multi_select"].includes(this.action.actionType)) {
      return "action-span-full";
    }
    if (this.action.layout?.span && this.action.layout.span >= 1) {
      return "action-span-full";
    }
    return "";
  }
}
</script>

<style scoped>
.action-item {
  width: 100%;
}
.action-span-full {
  width: 100%;
}
.actionStyle {
  margin-top: 0px;
  margin-left: 2px;
  margin-right: 2px;
  text-align: left;
}
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
}
.action-label {
  flex: 1 1 auto;
  text-align: left;
}
.action-control {
  flex: 0 0 auto;
  min-width: 160px;
  max-width: 260px;
}
.action-switch {
  margin: 0;
}
.actionButton >>> .defaultBtn {
  width: 100%;
  min-width: 0;
}
.action-button-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.action-color-preview {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.myswitch {
  margin-top: 1px;
  margin-left: 5px;
  margin-right: 5px;
}
.myswitch >>> .v-messages {
  min-height: 0px;
}
.myswitch >>> .v-input__slot {
  margin-bottom: 1px !important;
}
.myswitch >>> .v-select__selection--comma {
  margin-bottom: 0px;
  min-height: 20px;
}
.pStyle {
  margin-bottom: 4px;
  text-align: left;
}
.mytext >>> .v-input__slot {
  margin-bottom: 0px !important;
}
</style>
