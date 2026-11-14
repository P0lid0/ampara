#cloud-config
hostname: ampara-vm
manage_etc_hosts: true
users:
  - name: ampara
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: true
    ssh_authorized_keys:
      - __CHAVE_PUBLICA__
ssh_pwauth: false
