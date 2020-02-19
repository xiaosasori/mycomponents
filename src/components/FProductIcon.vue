<template functional lang="pug">
    i(:class="`shipping-type shipping-type--${props.icon}`")
</template>

<style lang="sass">
    i.shipping-type
        width: 24px
        height: 24px
        display: inline-block
        vertical-align: middle
        &--cut
            background-image: url('~@/assets/shipping-type-cut.svg')
        &--pot
            background-image: url('~@/assets/shipping-type-pot.svg')
</style>

<script>
    export default {
        props: {
            icon: {
                type: String,
                required: true
            }
        }
    }
</script>
