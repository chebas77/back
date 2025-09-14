export function me(req, res) {
  // req.user viene del middleware JWT (sub, name, email)
  return res.json({ user: req.user });
}
