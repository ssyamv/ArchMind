<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const router = useRouter()
router.replace('/settings/profile?tab=models')
</script>
