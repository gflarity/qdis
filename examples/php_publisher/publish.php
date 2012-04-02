<?php
  // prepend a base path if Predis is not present in your "include_path".
require 'Predis/Autoloader.php';

Predis\Autoloader::register();

$redis = new Predis\Client();

while ( 1 ) {
  usleep( 100000 );
  $redis->lpush('pub', 'from php at ' . time() );
  $redis->publish('pub', '1');
}

