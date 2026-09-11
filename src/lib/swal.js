// src/lib/swal.js
import Swal from "sweetalert2";

const base = Swal.mixin({
  customClass: {
    popup: "rounded-box",
    confirmButton: "btn btn-primary",
    cancelButton: "btn btn-ghost",
    denyButton: "btn btn-error",
  },
  buttonsStyling: false,
});

// Top-center auto-dismissing toast
export const toast = (title, icon = "success") =>
  base.fire({
    toast: true,
    position: "top",
    icon,
    title,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });

export const alertSuccess = (title, text) =>
  base.fire({ icon: "success", title, text, confirmButtonText: "OK" });

export const alertError = (title, text) =>
  base.fire({ icon: "error", title, text, confirmButtonText: "OK" });

export const alertInfo = (title, text) =>
  base.fire({ icon: "info", title, text, confirmButtonText: "OK" });

export const confirmDelete = async (title, text) => {
  const res = await base.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: "Yes, delete",
    cancelButtonText: "Cancel",
  });
  return res.isConfirmed;
};

export const confirmAction = async (title, text, confirmText = "Confirm") => {
  const res = await base.fire({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
  });
  return res.isConfirmed;
};

// Single text prompt (returns null on cancel)
export const promptText = async (title, inputValue = "") => {
  const res = await base.fire({
    title,
    input: "text",
    inputValue,
    showCancelButton: true,
    confirmButtonText: "OK",
    cancelButtonText: "Cancel",
    inputValidator: (value) => (!value ? "This field is required" : null),
  });
  return res.isConfirmed ? res.value : null;
};

// Password reset modal — two password fields, validated
export const promptPasswordReset = async (userName) => {
  const res = await base.fire({
    title: `Reset password`,
    html: `
      <p style="margin-bottom: 8px; font-size: 14px; opacity: 0.7;">
        For <strong>${userName}</strong>
      </p>
      <input
        id="swal-newpass"
        class="swal2-input"
        type="password"
        placeholder="New password"
        autocomplete="new-password"
      />
      <input
        id="swal-confirmpass"
        class="swal2-input"
        type="password"
        placeholder="Confirm password"
        autocomplete="new-password"
      />
    `,
    showCancelButton: true,
    confirmButtonText: "Reset",
    cancelButtonText: "Cancel",
    focusConfirm: false,
    didOpen: () => {
      document.getElementById("swal-newpass").focus();
    },
    preConfirm: () => {
      const newPassword = document.getElementById("swal-newpass").value;
      const confirmPassword = document.getElementById("swal-confirmpass").value;
      if (!newPassword || newPassword.length < 8) {
        Swal.showValidationMessage("Password must be at least 8 characters");
        return false;
      }
      if (newPassword !== confirmPassword) {
        Swal.showValidationMessage("Passwords do not match");
        return false;
      }
      return { newPassword, confirmPassword };
    },
  });
  return res.isConfirmed ? res.value : null;
};
