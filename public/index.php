<?php

declare(strict_types=1);

use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Psr7\ServerRequest;
use Symfony\Component\Cache\Adapter\FilesystemAdapter;
use Symfony\Component\Cache\CacheItem;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\ErrorHandler\Debug;
use Zend\HttpHandlerRunner\Emitter\SapiEmitter;

require_once __DIR__ . '/../vendor/autoload.php';

// Load dotenv
(new Dotenv())->usePutenv()->load(__DIR__ . '/../.env');

// Enable debug
if (getenv('APP_ENV') !== 'prod') {
    Debug::enable();
}

// Set up cache
$cache = new FilesystemAdapter('redirects', 500, __DIR__ . '/../cache');
$item = $cache->getItem('redirects');

// Get the sheet
$url = getenv('SHEET_URI');
$client = new Client();

try {
    $csv = $client->request('get', $url);
    $body = $csv->getBody()->getContents();
    $cache->save($item->set($body));
} catch (Throwable $e) {
    $body = $item->get();
}
// Explode into lines and remove header line
$raw = explode(PHP_EOL, $body);
array_shift($raw);

$request = ServerRequest::fromGlobals();

$strip = [
    '/^(.+)\.s\.kor\.vin$/',
    '/^(.+)\.kor\.vin$/',
    '/^(.+)\.s\.kor\.vin\.test$/',
    '/^(.+)\.kor\.vin\.test$/',
];

// Resolve the redirect ID
$host = $request->getUri()->getHost();
$match = null;

foreach ($strip as $regex) {
    $matches = [];
    if (preg_match($regex, $host, $matches)) {
        [, $match] = $matches;
        break;
    }
}

// Find a matching row
$redirectUri = null;
foreach ($raw as $line) {
    [$key, $redirect] = str_getcsv($line);
    if ($key === $match) {
        $redirectUri = $redirect;
        break;
    }
}

// Handle output
if ($redirectUri) {
    $response = new Response(307, ['Location' => $redirectUri]);
} else {
    ob_start();
    require(__DIR__ . '/../templates/not-found.php');
    $body = ob_get_contents();
    ob_end_clean();

    $response = new Response(404, [], $body);
}
(new SapiEmitter())->emit($response);
