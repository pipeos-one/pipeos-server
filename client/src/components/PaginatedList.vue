<template>
  <div class="paginatedlist">
      <div class="text-xs-center" style="padding-top:10px;padding-bottom:10px;">
          <v-pagination
            :length="pages"
            :value="currentPage"
            total-visible="11"
            v-on:input="changePage"
          ></v-pagination>
      </div>
    <div v-if="items.length === 0">
        <p class="text-xs-left caption font-weight-medium">Pipeline database does not contain contracts deployed on this chain.
        To see & play with Pipeline stored contracts, change to Ropsten, Rinkeby or Kovan.</p>
        <p class="text-xs-left caption font-weight-medium">Otherwise, import your own deployed contracts from Remix.</p>
    </div>
    <v-list dense v-if="items.length > 0">
        <PipeTree
            :items="items"
            :loadToRemix="isRemix"
            :loadToTree="1"
            v-on:item-toggle="itemToggle"
            v-on:subitem-toggle="subitemToggle"
            v-on:load-remix="loadToRemix"
        />
    </v-list>
  </div>
</template>
<script>
import Vue from 'vue';
import PipeTree from './PipeTree';

export default {
    components: {
        PipeTree,
    },
    props: ['items', 'pages', 'currentPage', 'isRemix'],
    created() {
        this.pages =  this.pages || 1;
    },
    methods: {
        isActive: function(page) {
            return page == this.currentPage;
        },
        changePage: function(page) {
            this.$emit('change-page', page);
        },
        loadToRemix: function(item) {
            this.$emit('load-remix', item);
        },
        itemToggle: function(item) {
            this.$emit('item-toggle', item);
        },
        subitemToggle: function(item) {
            this.$emit('subitem-toggle', item);
        },
    }
};
</script>

<style>
h1,
h2 {
  font-weight: normal;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  display: inline-block;
  margin: 0 10px;
}

.paginate-list {
  width: 90%;
  margin: 0 auto;
  text-align: left;
}

.paginate-list>li {
  display: block;
}

.paginate-list>li:before {
  content: '⚬ ';
  font-weight: bold;
  color: slategray;
}
.v-pagination>li {
    margin: 0 !important;
}
.v-pagination__item, .v-pagination__navigation {
    max-width: 20px;
    max-height: 20px;
    min-width: 22px !important;
    padding: 0 !important;
    margin: 0 2px !important;
    font-size: 10px;
}
.v-pagination__navigation .v-icon {
    font-size: 14px !important;
}
.paginatedlist .v-list {
    padding: 0;
}
</style>
