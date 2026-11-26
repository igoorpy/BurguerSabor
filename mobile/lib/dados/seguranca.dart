import 'dart:convert';

import 'package:crypto/crypto.dart';

/// A senha nunca é guardada como foi digitada: guardamos só o "hash" (um código embaralhado).
/// O e-mail entra junto para que duas pessoas com a mesma senha tenham códigos diferentes.
String hashSenha(String email, String senha) {
  final texto = '${email.trim().toLowerCase()}:$senha';
  return sha256.convert(utf8.encode(texto)).toString();
}
