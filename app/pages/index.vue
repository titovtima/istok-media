<script setup lang="ts">
import { useChecklistSocket } from '~/composables/useChecklistSocket'

const socket = useChecklistSocket()
</script>

<template>
  <div class="wrap">
    <div>
      <BrandBar />
      <h1>Медиаслужение</h1>
      <p class="subtitle">
        Внутренние инструменты медиа-команды. Выберите, что нужно прямо сейчас.
      </p>
    </div>

    <nav class="home-menu">
      <NuxtLink to="/checklist" class="menu-card">
        <div class="menu-title">Пульт медиаслужения</div>
        <div class="menu-desc">
          Чек-лист технической готовности перед собранием. Отметки синхронизируются
          между устройствами команды в реальном времени.
        </div>
        <div class="menu-arrow" aria-hidden="true">→</div>
      </NuxtLink>


      <NuxtLink to="/calendar" class="menu-card">
        <div class="menu-title">Календарь залов и студии</div>
        <div class="menu-desc">
          Бронирование малого зала, большого зала и студии. Регулярные брони,
          отмена на конкретную дату, отметки присутствия.
        </div>
        <div class="menu-arrow" aria-hidden="true">→</div>
      </NuxtLink>

      <NuxtLink to="/feedback" class="menu-card">
        <div class="menu-title">Обратная связь</div>
        <div class="menu-desc">
          Журнал обращений по прославлению, порядку, уборке и медиа. Общий для команды.
        </div>
        <div class="menu-arrow" aria-hidden="true">→</div>
      </NuxtLink>
    </nav>

    <div class="ws-status" :data-on="socket.isConnected.value ? 'true' : 'false'">
      <span class="ws-dot" />
      <template v-if="socket.isConnected.value">онлайн</template>
      <template v-else>нет соединения</template>
    </div>

    <footer>«Источник Жизни» · внутренние инструменты</footer>
  </div>
</template>
